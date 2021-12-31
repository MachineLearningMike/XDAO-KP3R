//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

/** 
 * @title Ballot
 * @dev Implements voting process along with vote delegation
 */
interface IBallot {

    struct Voter {
        uint weight; // weight is accumulated by delegation
        bool voted;  // if true, that person already voted
        address delegate; // person delegated to
        uint vote;   // index of the voted proposal
    }

    struct Proposal {
        // If you can limit the length to a certain number of bytes, 
        // always use one of bytes1 to bytes32 because they are much cheaper
        string name;   // short name (up to 32 bytes)
        uint voteCount; // number of accumulated votes
    }

    function chairPerson() external virtual returns(address);
    function voters(address holder) external virtual returns(uint weight, bool voted, address delegate, uint vote);
    //function proposals() external virtual returns(Proposal[] memory);
    function giveRightToVote(address voter) external virtual;
    function delegate(address to) external virtual;
    function vote(uint proposal) external virtual;
    function winningProposal() external view returns (uint winningProposal_);
    function winnerName() external view returns (string memory winnerName_);
}
