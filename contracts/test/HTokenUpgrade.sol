/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { HToken } from "../HToken.sol";

/// Test contract to verify if adding functions to the base token works. It does. You can ignore this.
contract HTokenUpgrade is HToken {
    event TestEvent(
        string data
    );

    function test() external {
        emit TestEvent("some data");
    }
}