/// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { BMToken } from "../BMToken.sol";

contract BMTokenUpgrade is BMToken {
    event TestEvent(
        string data
    );

    function test() external {
        emit TestEvent("some data");
    }
}