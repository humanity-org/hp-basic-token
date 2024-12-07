// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./IBMEnabledToken.sol";

interface IReverseToken is IBMEnabledToken {
    struct RegistrationParams {
        address l2TokenAddress;
        uint256 maxSubmissionCostForCustomGateway;
        uint256 maxSubmissionCostForRouter;
        uint256 maxGasForCustomGateway;
        uint256 maxGasForRouter;
        uint256 gasPriceBid;
        uint256 valueForGateway;
        uint256 valueForRouter;
        address creditBackAddress;
    }

    function registerTokenOnL2(RegistrationParams memory novaParams) external payable;

    function bridgeMint(address account, uint256 amount) external;

    function bridgeBurn(address account, uint256 amount) external;
}
