// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Bantah Challenge Registry
 * @notice Core contract for registering challenges onchain
 * @dev Hybrid architecture: Trust layer onchain, speed layer offchain
 */
contract ChallengeRegistry is Ownable, ReentrancyGuard {

    // Challenge types
    enum ChallengeType {
        P2P,      // Direct user vs user
        ADMIN,    // Admin-created challenge
        HOUSE     // House/pool challenge
    }

    // Challenge status
    enum ChallengeStatus {
        CREATED,    // Just registered
        ACTIVE,     // Accepting stakes
        MATCHED,    // Participants matched
        SETTLING,   // Result being determined
        SETTLED,    // Funds distributed
        CANCELLED   // Challenge cancelled
    }

    struct Challenge {
        bytes32 id;
        address creator;
        ChallengeType challengeType;
        bytes32 rulesHash;        // Hash of offchain rules/details
        uint256 createdAt;
        uint256 maxParticipants;
        uint256 currentParticipants;
        ChallengeStatus status;
        address escrowContract;   // Linked escrow for this challenge
        bytes32 result;          // Result hash when settled
    }

    // State
    mapping(bytes32 => Challenge) public challenges;
    mapping(address => bytes32[]) public userChallenges;

    // Events
    event ChallengeCreated(
        bytes32 indexed challengeId,
        address indexed creator,
        ChallengeType challengeType,
        bytes32 rulesHash,
        address escrowContract
    );

    event ChallengeStatusUpdated(
        bytes32 indexed challengeId,
        ChallengeStatus oldStatus,
        ChallengeStatus newStatus
    );

    event ChallengeSettled(
        bytes32 indexed challengeId,
        bytes32 result
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new challenge onchain
     * @param challengeId Unique challenge identifier (from offchain)
     * @param challengeType Type of challenge
     * @param rulesHash Hash of challenge rules/details
     * @param maxParticipants Maximum participants allowed
     * @param escrowContract Address of escrow contract for this challenge
     */
    function registerChallenge(
        bytes32 challengeId,
        ChallengeType challengeType,
        bytes32 rulesHash,
        uint256 maxParticipants,
        address escrowContract
    ) external nonReentrant {

        require(challenges[challengeId].id == bytes32(0), "Challenge already exists");
        require(escrowContract != address(0), "Invalid escrow contract");

        Challenge memory newChallenge = Challenge({
            id: challengeId,
            creator: msg.sender,
            challengeType: challengeType,
            rulesHash: rulesHash,
            createdAt: block.timestamp,
            maxParticipants: maxParticipants,
            currentParticipants: 0,
            status: ChallengeStatus.CREATED,
            escrowContract: escrowContract,
            result: bytes32(0)
        });

        challenges[challengeId] = newChallenge;
        userChallenges[msg.sender].push(challengeId);

        emit ChallengeCreated(
            challengeId,
            msg.sender,
            challengeType,
            rulesHash,
            escrowContract
        );
    }

    /**
     * @notice Update challenge status (called by authorized parties)
     * @param challengeId Challenge to update
     * @param newStatus New status
     */
    function updateChallengeStatus(
        bytes32 challengeId,
        ChallengeStatus newStatus
    ) external {

        Challenge storage challenge = challenges[challengeId];
        require(challenge.id != bytes32(0), "Challenge not found");

        // Only creator or escrow contract can update status
        require(
            msg.sender == challenge.creator ||
            msg.sender == challenge.escrowContract ||
            msg.sender == owner(),
            "Unauthorized"
        );

        ChallengeStatus oldStatus = challenge.status;
        challenge.status = newStatus;

        emit ChallengeStatusUpdated(challengeId, oldStatus, newStatus);
    }

    /**
     * @notice Settle challenge with result
     * @param challengeId Challenge to settle
     * @param result Result hash
     */
    function settleChallenge(
        bytes32 challengeId,
        bytes32 result
    ) external {

        Challenge storage challenge = challenges[challengeId];
        require(challenge.id != bytes32(0), "Challenge not found");
        require(challenge.status != ChallengeStatus.SETTLED, "Already settled");

        // Only escrow contract or authorized oracle can settle
        require(
            msg.sender == challenge.escrowContract ||
            msg.sender == owner(),
            "Unauthorized to settle"
        );

        challenge.status = ChallengeStatus.SETTLED;
        challenge.result = result;

        emit ChallengeSettled(challengeId, result);
    }

    /**
     * @notice Increment participant count
     * @param challengeId Challenge ID
     */
    function incrementParticipants(bytes32 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.id != bytes32(0), "Challenge not found");
        require(challenge.currentParticipants < challenge.maxParticipants, "Max participants reached");

        challenge.currentParticipants++;
    }

    // View functions
    function getChallenge(bytes32 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    function getUserChallenges(address user) external view returns (bytes32[] memory) {
        return userChallenges[user];
    }

    function getChallengeCount() external view returns (uint256) {
        // This would need to be implemented with a counter for gas efficiency
        return 0; // Placeholder
    }
}