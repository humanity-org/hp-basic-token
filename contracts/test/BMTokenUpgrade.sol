/// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { BMToken } from "../BMToken.sol";

/// @title Test contract to verify if adding functions to the base token works. It does. You can ignore this.
contract BMTokenUpgrade is BMToken {
    event TestEvent(
        string data
    );

    function test() external {
        emit TestEvent("some data");
    }
}