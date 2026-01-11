// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Bantah Escrow Vault
 * @notice Handles staking, escrow, and payout for challenges
 * @dev Works with ChallengeRegistry for trust-minimized settlements
 */
contract EscrowVault is Ownable, ReentrancyGuard {

    // Challenge sides for P2P challenges
    enum ChallengeSide {
        NONE,
        YES,
        NO
    }

    struct Stake {
        address user;
        uint256 amount;
        ChallengeSide side;  // For P2P challenges
        uint256 stakedAt;
        bool claimed;
    }

    struct ChallengePool {
        bytes32 challengeId;
        address token;              // ERC20 token address (0x0 for ETH)
        uint256 totalStaked;
        uint256 yesStaked;          // For P2P challenges
        uint256 noStaked;           // For P2P challenges
        bool isSettled;
        ChallengeSide winningSide;
        mapping(address => Stake) stakes;
        address[] stakers;
    }

    // State
    mapping(bytes32 => ChallengePool) public challengePools;
    mapping(address => uint256) public userBalances; // For bonus tokens

    address public challengeRegistry;
    address public authorizedOracle;

    // Events
    event StakeLocked(
        bytes32 indexed challengeId,
        address indexed user,
        uint256 amount,
        ChallengeSide side
    );

    event ChallengeSettled(
        bytes32 indexed challengeId,
        ChallengeSide winningSide,
        uint256 totalPayout
    );

    event PayoutClaimed(
        bytes32 indexed challengeId,
        address indexed user,
        uint256 amount
    );

    event BonusDeposited(
        address indexed user,
        uint256 amount
    );

    constructor(address _challengeRegistry) Ownable(msg.sender) {
        challengeRegistry = _challengeRegistry;
    }

    modifier onlyRegistry() {
        require(msg.sender == challengeRegistry, "Only registry");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == authorizedOracle || msg.sender == owner(), "Only oracle");
        _;
    }

    /**
     * @notice Set authorized oracle for settlement
     */
    function setOracle(address _oracle) external onlyOwner {
        authorizedOracle = _oracle;
    }

    /**
     * @notice Lock stake for a challenge (ETH)
     * @param challengeId Challenge to stake in
     * @param side Side to stake on (for P2P)
     */
    function lockStakeETH(
        bytes32 challengeId,
        ChallengeSide side
    ) external payable nonReentrant {

        require(msg.value > 0, "Must stake ETH");
        require(side != ChallengeSide.NONE, "Invalid side");

        _lockStake(challengeId, address(0), msg.value, side);
    }

    /**
     * @notice Lock stake for a challenge (ERC20)
     * @param challengeId Challenge to stake in
     * @param token ERC20 token address
     * @param amount Amount to stake
     * @param side Side to stake on (for P2P)
     */
    function lockStakeERC20(
        bytes32 challengeId,
        address token,
        uint256 amount,
        ChallengeSide side
    ) external nonReentrant {

        require(amount > 0, "Must stake tokens");
        require(token != address(0), "Invalid token");
        require(side != ChallengeSide.NONE, "Invalid side");

        // Transfer tokens from user
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        _lockStake(challengeId, token, amount, side);
    }

    /**
     * @notice Internal stake locking logic
     */
    function _lockStake(
        bytes32 challengeId,
        address token,
        uint256 amount,
        ChallengeSide side
    ) internal {

        ChallengePool storage pool = challengePools[challengeId];

        // Initialize pool if first stake
        if (pool.stakers.length == 0) {
            pool.challengeId = challengeId;
            pool.token = token;
        } else {
            require(pool.token == token, "Token mismatch");
            require(!pool.isSettled, "Challenge settled");
        }

        // Check if user already staked
        if (pool.stakes[msg.sender].amount > 0) {
            // Update existing stake
            pool.stakes[msg.sender].amount += amount;
            pool.stakes[msg.sender].side = side;
        } else {
            // New stake
            pool.stakes[msg.sender] = Stake({
                user: msg.sender,
                amount: amount,
                side: side,
                stakedAt: block.timestamp,
                claimed: false
            });
            pool.stakers.push(msg.sender);
        }

        // Update pool totals
        pool.totalStaked += amount;
        if (side == ChallengeSide.YES) {
            pool.yesStaked += amount;
        } else if (side == ChallengeSide.NO) {
            pool.noStaked += amount;
        }

        emit StakeLocked(challengeId, msg.sender, amount, side);
    }

    /**
     * @notice Settle challenge and determine winners
     * @param challengeId Challenge to settle
     * @param winningSide The winning side
     */
    function settleChallenge(
        bytes32 challengeId,
        ChallengeSide winningSide
    ) external onlyOracle nonReentrant {

        ChallengePool storage pool = challengePools[challengeId];
        require(!pool.isSettled, "Already settled");
        require(pool.totalStaked > 0, "No stakes");

        pool.isSettled = true;
        pool.winningSide = winningSide;

        uint256 totalWinningStake;
        if (winningSide == ChallengeSide.YES) {
            totalWinningStake = pool.yesStaked;
        } else if (winningSide == ChallengeSide.NO) {
            totalWinningStake = pool.noStaked;
        }

        emit ChallengeSettled(challengeId, winningSide, pool.totalStaked);
    }

    /**
     * @notice Claim payout for settled challenge
     * @param challengeId Challenge to claim from
     */
    function claimPayout(bytes32 challengeId) external nonReentrant {

        ChallengePool storage pool = challengePools[challengeId];
        require(pool.isSettled, "Not settled");

        Stake storage userStake = pool.stakes[msg.sender];
        require(userStake.amount > 0, "No stake");
        require(!userStake.claimed, "Already claimed");
        require(userStake.side == pool.winningSide, "Not winner");

        userStake.claimed = true;

        uint256 payoutAmount;
        if (pool.winningSide == ChallengeSide.YES) {
            // Proportional payout from NO stakes
            payoutAmount = userStake.amount + (userStake.amount * pool.noStaked) / pool.yesStaked;
        } else if (pool.winningSide == ChallengeSide.NO) {
            // Proportional payout from YES stakes
            payoutAmount = userStake.amount + (userStake.amount * pool.yesStaked) / pool.noStaked;
        }

        // Transfer payout
        if (pool.token == address(0)) {
            // ETH payout
            (bool success,) = payable(msg.sender).call{value: payoutAmount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 payout
            IERC20(pool.token).transfer(msg.sender, payoutAmount);
        }

        emit PayoutClaimed(challengeId, msg.sender, payoutAmount);
    }

    /**
     * @notice Deposit bonus tokens for user (offchain bonus bridging)
     * @param user User to credit
     * @param amount Bonus amount
     */
    function depositBonus(address user, uint256 amount) external onlyOwner {
        userBalances[user] += amount;
        emit BonusDeposited(user, amount);
    }

    /**
     * @notice Get user's bonus balance
     */
    function getBonusBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    /**
     * @notice Emergency withdrawal (only owner, extreme cases)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }

    // Receive ETH
    receive() external payable {}
}