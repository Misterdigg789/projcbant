// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Bantah Challenge Resolver
 * @notice Oracle service for settling challenges
 * @dev Can be upgraded to decentralized oracle network later
 */
contract ChallengeResolver is Ownable, ReentrancyGuard {

    enum ChallengeSide {
        NONE,
        YES,
        NO
    }

    struct ResolutionRequest {
        bytes32 challengeId;
        address requester;
        ChallengeSide proposedResult;
        uint256 timestamp;
        bool resolved;
    }

    // State
    address public challengeRegistry;
    address public escrowVault;

    mapping(bytes32 => ResolutionRequest) public resolutionRequests;
    mapping(address => bool) public authorizedResolvers;

    uint256 public resolutionFee = 0.001 ether; // Small fee for spam prevention
    uint256 public constant RESOLUTION_TIMEOUT = 24 hours;

    // Events
    event ResolutionRequested(
        bytes32 indexed challengeId,
        address indexed requester,
        ChallengeSide proposedResult
    );

    event ChallengeResolved(
        bytes32 indexed challengeId,
        ChallengeSide result,
        address resolver
    );

    event ResolverAuthorized(address resolver);
    event ResolverRevoked(address resolver);

    constructor(
        address _challengeRegistry,
        address _escrowVault
    ) Ownable(msg.sender) {
        challengeRegistry = _challengeRegistry;
        escrowVault = _escrowVault;
        authorizedResolvers[msg.sender] = true;
    }

    modifier onlyAuthorizedResolver() {
        require(authorizedResolvers[msg.sender], "Not authorized resolver");
        _;
    }

    /**
     * @notice Authorize a resolver address
     */
    function authorizeResolver(address resolver) external onlyOwner {
        authorizedResolvers[resolver] = true;
        emit ResolverAuthorized(resolver);
    }

    /**
     * @notice Revoke resolver authorization
     */
    function revokeResolver(address resolver) external onlyOwner {
        authorizedResolvers[resolver] = false;
        emit ResolverRevoked(resolver);
    }

    /**
     * @notice Set resolution fee
     */
    function setResolutionFee(uint256 _fee) external onlyOwner {
        resolutionFee = _fee;
    }

    /**
     * @notice Request challenge resolution (anyone can request)
     * @param challengeId Challenge to resolve
     * @param proposedResult Proposed outcome
     */
    function requestResolution(
        bytes32 challengeId,
        ChallengeSide proposedResult
    ) external payable nonReentrant {

        require(msg.value >= resolutionFee, "Insufficient fee");
        require(proposedResult != ChallengeSide.NONE, "Invalid result");
        require(!resolutionRequests[challengeId].resolved, "Already resolved");

        resolutionRequests[challengeId] = ResolutionRequest({
            challengeId: challengeId,
            requester: msg.sender,
            proposedResult: proposedResult,
            timestamp: block.timestamp,
            resolved: false
        });

        emit ResolutionRequested(challengeId, msg.sender, proposedResult);
    }

    /**
     * @notice Resolve challenge (only authorized resolvers)
     * @param challengeId Challenge to resolve
     * @param finalResult Final outcome
     */
    function resolveChallenge(
        bytes32 challengeId,
        ChallengeSide finalResult
    ) external onlyAuthorizedResolver nonReentrant {

        ResolutionRequest storage request = resolutionRequests[challengeId];
        require(!request.resolved, "Already resolved");
        require(finalResult != ChallengeSide.NONE, "Invalid result");

        // Mark as resolved
        request.resolved = true;

        // Call escrow vault to settle
        IEscrowVault(escrowVault).settleChallenge(challengeId, finalResult);

        emit ChallengeResolved(challengeId, finalResult, msg.sender);
    }

    /**
     * @notice Batch resolve multiple challenges
     */
    function batchResolveChallenges(
        bytes32[] calldata challengeIds,
        ChallengeSide[] calldata results
    ) external onlyAuthorizedResolver nonReentrant {

        require(challengeIds.length == results.length, "Array length mismatch");

        for (uint256 i = 0; i < challengeIds.length; i++) {
            if (!resolutionRequests[challengeIds[i]].resolved) {
                resolutionRequests[challengeIds[i]].resolved = true;
                IEscrowVault(escrowVault).settleChallenge(challengeIds[i], results[i]);
                emit ChallengeResolved(challengeIds[i], results[i], msg.sender);
            }
        }
    }

    /**
     * @notice Withdraw accumulated fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }

    /**
     * @notice Get resolution request details
     */
    function getResolutionRequest(bytes32 challengeId) external view returns (ResolutionRequest memory) {
        return resolutionRequests[challengeId];
    }

    // Interface for escrow vault
    interface IEscrowVault {
        function settleChallenge(bytes32 challengeId, ChallengeSide winningSide) external;
    }

    // Receive ETH for fees
    receive() external payable {}
}