pragma solidity ^0.4.17;
// v1.0

import "../aux/Mortal.sol";
import "../bondage/BondageInterface.sol";
import "./ArbiterStorage.sol";

contract Arbiter is Mortal {
    // Called when a data purchase is initiated
    event LogDataPurchase(
        address provider,          // Etheruem address of the provider
        address subscriber,        // Ethereum address of the subscriber
        uint256 public_key,        // Public key of the subscriber
        uint256 amount,            // Amount (in 1/100 TOK) of ethereum sent
        bytes32[] endpoint_params, // Endpoint specific(nonce,encrypted_uuid),
        bytes32 endpoint
    );

    // Used to specify who is the terminator of a contract
    enum SubscriptionTerminator { Provider, Subscriber }

    // Called when a data subscription is ended by either provider or terminator
    event LogDataSubscriptionEnd(
        address provider,                      // Provider from the subscription
        address subscriber,                    // Subscriber from the subscription
        SubscriptionTerminator terminator      // Which terminated the contract
    ); 
    
    ArbiterStorage stor;
    BondageInterface bondage;

    function Arbiter(address storageAddress, address bondageAddress) public {
        stor = ArbiterStorage(storageAddress);
        setBondageAddress(bondageAddress);
    }

    /// @notice Reinitialize bondage instance after upgrade
    function setBondageAddress(address bondageAddress) public onlyOwner {
        bondage = BondageInterface(bondageAddress);
    }

    function initiateSubscription(
        address providerAddress,   // Provider address
        bytes32[] endpoint_params, // Endpoint specific params
        bytes32 endpoint,          // Endpoint specifier
        uint256 public_key,        // Public key of the purchaser
        uint64 blocks              // Number of blocks subscribed, 1block=1dot
    ) 
        public 
    {   
        // Must be atleast one block
        require(blocks > 0);

        // Can't reinitiate a currently active contract
        require(stor.getDots(providerAddress, msg.sender, endpoint) == 0);

        // Escrow the necessary amount of dots
        bondage.escrowDots(msg.sender, providerAddress, endpoint, blocks);
        
        // Initiate the subscription struct
        stor.setSubscription(
            providerAddress,
            msg.sender,
            endpoint,
            blocks,
            uint96(block.number),
            uint96(block.number) + uint96(blocks)
        );

        // Emit the event
        LogDataPurchase(
            providerAddress,
            msg.sender,
            public_key,
            blocks,
            endpoint_params,
            endpoint
        );
    }

    function getSubscription(address providerAddress, address subscriberAddress, bytes32 endpoint)
        public
        view
        returns (uint64 dots, uint96 blockStart, uint96 preBlockEnd)
    {
        return (
            stor.getDots(providerAddress, subscriberAddress, endpoint),
            stor.getBlockStart(providerAddress, subscriberAddress, endpoint),
            stor.getPreBlockEnd(providerAddress, subscriberAddress, endpoint)
        );
    }

    /// @dev Finish the data feed from the provider
    function endSubscriptionProvider(        
        address subscriberAddress,
        bytes32 endpoint
    )
        public 
    {
        // Emit an event on success about who ended the contract
        if (endSubscription(msg.sender, subscriberAddress, endpoint))
            LogDataSubscriptionEnd(
                msg.sender, 
                subscriberAddress, 
                SubscriptionTerminator.Provider
            );
    }

    /// @dev Finish the data feed from the subscriber
    function endSubscriptionSubscriber(
        address providerAddress,
        bytes32 endpoint
    )
        public 
    {
        // Emit an event on success about who ended the contract
        if (endSubscription(providerAddress, msg.sender, endpoint))
            LogDataSubscriptionEnd(
                providerAddress,
                msg.sender,
                SubscriptionTerminator.Subscriber
            );
    }

    /// @dev Finish the data feed
    function endSubscription(        
        address providerAddress,
        address subscriberAddress,
        bytes32 endpoint
    )
        private
        returns (bool)
    {
        uint256 dots = stor.getDots(providerAddress, subscriberAddress, endpoint);
        uint256 preblockend = stor.getPreBlockEnd(providerAddress, subscriberAddress, endpoint);
        // Make sure the subscriber has a subscription
        require(dots > 0);

        if (block.number < preblockend) {
            // Subscription ended early
            uint256 earnedDots = (block.number * dots) / preblockend;
            uint256 returnedDots = dots - earnedDots;

            // Transfer the earned dots to the provider
            bondage.releaseDots(
                subscriberAddress,
                providerAddress,
                endpoint,
                earnedDots
            );
            //  Transfer the returned dots to the subscriber
            bondage.releaseDots(
                subscriberAddress,
                subscriberAddress,
                endpoint,
                returnedDots
            );
        } else {
            // Transfer all the dots
            bondage.releaseDots(
                subscriberAddress,
                providerAddress,
                endpoint,
                dots
            );
        }
        // Kill the subscription
        stor.deleteSubscription(providerAddress, subscriberAddress, endpoint);
        return true;
    }    
}