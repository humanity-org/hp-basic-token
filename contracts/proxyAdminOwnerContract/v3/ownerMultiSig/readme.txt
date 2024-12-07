To add the functionality of requiring **M approvals out of N owners** to the above multi-signature wallet contract, we already have a `requiredConfirmations` parameter that defines how many approvals are necessary. Below is an updated implementation with some improvements to explicitly support the **M of N owners** requirement.

---

### **Multi-Signature Wallet with M of N Approval**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MultiSigWallet is AccessControl {
    // Events
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(uint256 indexed txIndex, address indexed to, uint256 value, bytes data);
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    // Roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    // State variables
    uint256 public requiredConfirmations; // M in M of N
    address[] public owners; // N owners

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    Transaction[] public transactions;

    // Mapping to track confirmations (transactionIndex => (owner => isConfirmed))
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // Constructor
    constructor(address[] memory _owners, uint256 _requiredConfirmations) {
        require(_owners.length > 0, "Owners required");
        require(
            _requiredConfirmations > 0 && _requiredConfirmations <= _owners.length,
            "Invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!hasRole(OWNER_ROLE, owner), "Owner is not unique");

            _setupRole(OWNER_ROLE, owner);
            owners.push(owner);
        }
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);

        requiredConfirmations = _requiredConfirmations;
    }

    // Modifier to restrict actions to owners
    modifier onlyOwner() {
        require(hasRole(OWNER_ROLE, msg.sender), "Not an owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "Transaction already confirmed");
        _;
    }

    // Fallback to accept Ether
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // Submit a transaction
    function submitTransaction(address _to, uint256 _value, bytes memory _data)
        public
        onlyOwner
    {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(txIndex, _to, _value, _data);
    }

    // Confirm a transaction
    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    // Revoke confirmation
    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        require(isConfirmed[_txIndex][msg.sender], "Transaction not confirmed");

        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    // Execute a transaction
    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= requiredConfirmations,
            "Not enough confirmations"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "Transaction failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    // Get transaction details
    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }

    // Get list of owners
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    // Get the number of transactions
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
}
```

---

### **Key Changes**
1. **Required Confirmations (M of N Owners)**:
   - The `requiredConfirmations` state variable specifies the number of approvals needed (M).
   - This value is set during contract deployment and must be less than or equal to the number of owners (N).

2. **Confirmation Logic**:
   - A transaction can only be executed if it has at least `requiredConfirmations`.

3. **Revoke Confirmations**:
   - Owners can revoke their confirmations before the transaction is executed, reducing the `numConfirmations` count.

4. **Dynamic Owner Management**:
   - Owners are stored in the `owners` array and managed using OpenZeppelin’s `AccessControl`.

---

### **Deployment and Testing**
1. **Deploy the Contract**:
   - Use Remix or any other Ethereum environment.
   - Provide:
     - `owners`: List of owner addresses (e.g., `[address1, address2, address3]`).
     - `requiredConfirmations`: Minimum number of approvals (e.g., `2`).

2. **Deposit Funds**:
   - Send Ether to the contract address using the `receive()` function.

3. **Submit Transactions**:
   - Use `submitTransaction(address _to, uint256 _value, bytes _data)` to propose a transaction.

4. **Confirm and Execute**:
   - Call `confirmTransaction` from multiple owner accounts to reach the required number of confirmations.
   - Once the confirmations reach the `requiredConfirmations` threshold, execute the transaction using `executeTransaction`.

---

### **Benefits**
- Flexible and secure multi-sig setup.
- Dynamic M-of-N owner support.
- Transparent event logging for transactions and confirmations.
