pragma solidity ^0.4.17;

// getProviderRouteKeys and setEndpointParams FAILING, HAVE TO REWRITE TEST CASES (work in truffle console)

// NOTE IN initiateProvider

// RETURN BOOL FOR ALL SETTERS

// FINISH NatSpec DOCS FOR ALL CONTRACTS (MAYBE)
///Consider using @notice tag to utilize dynamic expressions
///https://github.com/ethereum/wiki/wiki/Ethereum-Natural-Specification-Format#dynamic-expressions

// SHOULD WE PUT VERSION NUMBERS AT THE TOP OF CONTRACTS SINCE THEY ARE UPGRADABLE? 
// WE COULD KEEP A NOTE IN THE API DOCS OF WHAT VERSION IS CURRENTLY DEPLOYED AND ALIVE.

import "./../aux/Mortal.sol";
import "./RegistryStorage.sol";

contract Registry is Mortal {  

    RegistryStorage stor;

    function Registry(address storageAddress) public {
        stor = RegistryStorage(storageAddress);
    }

    /// @dev Initiates a provider.
    /// If no address->Oracle mapping exists, Oracle object is created
    /// @param public_key unique id for provider. used for encyrpted key swap for subscription endpoints
    /// @param title name
    /// @param endpoint_specifier end
    /// @param endpoint_params endpoint specific params
    function initiateProvider(
        uint256 public_key,
        bytes32 title, 
        bytes32 endpoint_specifier,
        bytes32[] endpoint_params
    )
        public
        returns (bool success)
    {
        if(getProviderPublicKey(msg.sender) == 0) {
            stor.createOracle(msg.sender, public_key, title);
            if(endpoint_specifier != 0)
                setEndpointParams(endpoint_specifier, endpoint_params);

            stor.addOracle(msg.sender);
            // Do we want to store a reference to the oracleIndex in the Oracle struct?
            // See Pointer Logic in Inserts  
            // https://medium.com/@robhitchens/solidity-crud-part-1-824ffa69509a
            return true;
        }
        else {
            return false;            
        }
    }

    /// @dev Initiates an endpoint specific provider curve
    /// If oracle[specfifier] is uninitialized, Curve is mapped to specifier
    /// @param specifier specifier of endpoint. currently "smart_contract" or "socket_subscription"
    /// @param curveType dot-cost vs oracle-specific dot-supply
    /// @param curveStart y-offset of cost( always initial cost )
    /// @param curveMultiplier coefficient to curveType
    function initiateProviderCurve(
        bytes32 specifier,
        RegistryStorage.CurveType curveType,
        uint256 curveStart,
        uint256 curveMultiplier
    )
        public    
    {
        // Must have previously initiated themselves
        require(stor.getPublicKey(msg.sender) != 0);

        // Can't use None
        require(curveType != RegistryStorage.CurveType.None);

        // Can't reset their curve
        RegistryStorage.CurveType cType;
        (cType,) = stor.getCurve(msg.sender, specifier);
        require(cType == RegistryStorage.CurveType.None);

        stor.setCurve(msg.sender, specifier, curveType, curveStart, curveMultiplier);
    }

    function setEndpointParams(bytes32 specifier, bytes32[] endpoint_params) public {
        stor.setEndpointParameters(msg.sender, specifier, endpoint_params);
    }

    /// @return public key
    function getProviderPublicKey(address provider) public view returns (uint256) {
        return stor.getPublicKey(provider);
    }

    /// @return oracle name
    function getProviderTitle(address provider) public view returns (string) {
        return bytes32ToStr(stor.getTitle(provider));
    }

    /// @return endpoint-specific parameter
    function getNextEndpointParam(address provider, bytes32 specifier, uint256 index)
        public
        view
        returns (uint256 nextIndex, bytes32 endpoint_param)
    {
        uint256 len = stor.getEndpointIndexSize(provider, specifier);
        if (index < len) {
            endpoint_param = stor.getEndPointParam(provider, specifier, index);
            if (index + 1 < len) return (index + 1, endpoint_param);
            return (0, endpoint_param);
        }
        return(0,0);
    }

    /// @dev Get curve paramaters from oracle
    function getProviderCurve(
        address provider,
        bytes32 specifier
    )        
        public
        view
        returns (
            RegistryStorage.CurveType curveType,
            uint256 curveStart,
            uint256 curveMultiplier
        )
    {
        return stor.getCurve(provider, specifier);
    }

    function getNextProvider(uint256 index)
        public
        view        
        returns (uint256 nextIndex, address oracleAddress, uint256 public_key, string title)
    {
        uint256 len = stor.getOracleIndexSize();
        if (index < len) {
            oracleAddress = stor.getOracleAddress(index);
            if (index + 1 < len)
                return (
                    index + 1, 
                    oracleAddress, 
                    getProviderPublicKey(oracleAddress), 
                    getProviderTitle(oracleAddress)
                );            
            return (
                0, 
                oracleAddress, 
                getProviderPublicKey(oracleAddress), 
                getProviderTitle(oracleAddress)
            );                            
        }
        return (0,0x0,0,"");
    }

    function bytes32ToStr(bytes32 _bytes32) private pure returns (string) {
        bytes memory bytesArray = new bytes(32);

        for (uint256 i; i < 32; i++)
            bytesArray[i] = _bytes32[i];
        return string(bytesArray);
    }
}
