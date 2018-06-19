// import EVMRevert from './helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const expect = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .expect;

const Utils = require("./helpers/utils");
const EVMRevert = require("./helpers/EVMRevert");

const Dispatch = artifacts.require("Dispatch");
const DispatchStorage = artifacts.require("DispatchStorage");
const Bondage = artifacts.require("Bondage");
const BondageStorage = artifacts.require("BondageStorage");
const Registry = artifacts.require("Registry");
const RegistryStorage = artifacts.require("RegistryStorage");
const ZapToken = artifacts.require("ZapToken");
const Cost = artifacts.require("CurrentCost");
const Oracle = artifacts.require("TestProvider");
const Subscriber = artifacts.require("TestClient");

// const Subscriber = artifacts.require("Subscriber");

function showReceivedEvents(res) {
    for (let i = 0; i < bondRes.logs.length; i++) {
        let log = bondRes.logs[i];
        console.log("Event ", log.event);
        for (let j = 0; j < log.args.length; j++) {
            let arg = log.args[j];
            console.log("   ", arg);
        }
    }
}

function isEventReceived(logs, eventName) {
    for (let i in logs) {
        let log = logs[i];
        if (log.event === eventName) {
            return true;
        }
    }
    return false;
}

function getParamsFromIncomingEvent(logs) {
    for (let i in logs) {
        let log = logs[i];
        if (log.event === "Incoming") {
            let obj = new Object();
            obj.id = new BigNumber(log.args.id);
            obj.provider = log.args.provider.toString();
            obj.recipient = log.args.recipient.toString();
            obj.query = log.args.query.toString();
            obj.endpoint = log.args.endpoint.toString();
            obj.params = log.args.endpoint_params;

            return obj;
        }
    }
    return false;
}

contract('Dispatch', function (accounts) {
    const owner = accounts[0];
    const subscriber = accounts[1];
    const provider = accounts[2];

    const tokensForOwner = new BigNumber("5000e18");
    const tokensForSubscriber = new BigNumber("3000e18");
    const tokensForProvider = new BigNumber("2000e18");
    const approveTokens = new BigNumber("1000e18");

    const params = ["param1", "param2"];

    const spec1 = "Hello?";
    const spec2 = "Reverse";
    const spec3 = "Add";
    const spec4 = "Double";


    const publicKey = 10001;
    const title = "tst";
    const extInfo = [111, 222, 333];

    const piecewiseFunction = { // 2x^2
        constants: [2, 2, 0],
        parts: [0, 1000000000],
        dividers: [1]
    };

    const query = "query";

   /* async function prepareProvider(account = provider, curveParams = piecewiseFunction) {
        await this.registry.initiateProvider(publicKey, title, specifier, params, { from: account });
        await this.registry.initiateProviderCurve(specifier, curveParams.constants, curveParams.parts, curveParams.dividers, { from: account });
    }*/

/*  async function prepareProvider(curveParams = piecewiseFunction, account = provider) {
        await this.registry.initiateProvider(publicKey, title, specifier, params, {from: account});
        await this.registry.initiateProviderCurve(specifier, curveParams.constants, curveParams.parts, curveParams.dividers, { from: account });
}*/ 

/* OLD
    async function prepareTokens(sub = true) {
        await this.token.allocate(owner, tokensForOwner, { from: owner });
        await this.token.allocate(provider, tokensForProvider, { from: owner });
        if (sub) {
            await this.token.allocate(this.subscriber.address, tokensForSubscriber, { from: owner });
            // bond Zap
            await this.token.approve(this.bondage.address, approveTokens, {from: subscriber});
        }
    } */

    async function prepareTokens(allocAddress = subscriber) {
        await this.token.allocate(owner, tokensForOwner, { from: owner });
        await this.token.allocate(allocAddress, tokensForSubscriber, { from: owner });
        //await this.token.approve(this.bondage.address, approveTokens, {from: subscriber});
    }

    beforeEach(async function deployContracts() {
        this.currentTest.regStor = await RegistryStorage.new();
        this.currentTest.registry = await Registry.new(this.currentTest.regStor.address);
        await this.currentTest.regStor.transferOwnership(this.currentTest.registry.address);
        this.currentTest.token = await ZapToken.new();
        this.currentTest.oracle = await Oracle.new(this.currentTest.registry.address);

        this.currentTest.cost = await Cost.new(this.currentTest.registry.address);
        this.currentTest.bondStor = await BondageStorage.new();
        this.currentTest.bondage = await Bondage.new(this.currentTest.bondStor.address, this.currentTest.token.address, this.currentTest.cost.address);
        await this.currentTest.bondStor.transferOwnership(this.currentTest.bondage.address);

        this.currentTest.dispStor = await DispatchStorage.new();
        this.currentTest.dispatch = await Dispatch.new(this.currentTest.dispStor.address, this.currentTest.bondage.address);
        await this.currentTest.dispStor.transferOwnership(this.currentTest.dispatch.address);
        this.currentTest.subscriber = await Subscriber.new(this.currentTest.token.address, this.currentTest.dispatch.address, this.currentTest.bondage.address, this.currentTest.registry.address);
    });

    it("DISPATCH_1 - respond1() - Check that we can make a simple query", async function () {
        await prepareTokens.call(this.test, subscriber);

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        // watch events
        const dispatchEvents = this.test.dispatch.allEvents({ fromBlock: 0, toBlock: 'latest' });
        dispatchEvents.watch((err, res) => { });
        const subscriberEvents = this.test.subscriber.allEvents({ fromBlock: 0, toBlock: 'latest' });
        subscriberEvents.watch((err, res) => { }); 

        
        // holder: subAddr (holder of dots)
        // subscriber: owner of zap
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});

        // SUBSCRIBE SUBSCRIBER TO RECIVE DATA FROM PROVIDER
        await this.test.subscriber.testQuery(oracleAddr, query, spec1, params);

        // wait for callback

        // GET ALL EVENTS LOG 
        let logs = await subscriberEvents.get();
        await expect(isEventReceived(logs, "Result1")).to.be.equal(true);

        // subscriber should have emitted one event
        var result = logs[0].args["response1"];
        await expect(result).to.be.equal("Hello World");

        // STOP WATCHING EVENTS 
        dispatchEvents.stopWatching();
        subscriberEvents.stopWatching();
    });

    it("DISPATCH_2 - query() - Check query function will not be performed if subscriber will not have enough dots", async function () {
        await prepareTokens.call(this.test, subscriber);

        var oracleAddr = this.test.oracle.address;

        await expect(this.test.subscriber.testQuery(oracleAddr, query, spec1, params)).to.be.eventually.rejectedWith(EVMRevert);
    });


    it("DISPATCH_3 - query() - Check query function will not be performed if msg.sender is not subscriber", async function () {
        await prepareTokens.call(this.test, subscriber);

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});

        await expect(this.test.dispatch.query(oracleAddr, query, spec1, params, true, true, {from: accounts[4]})).to.be.eventually.rejectedWith(EVMRevert);
    }); 


    it("DISPATCH_4 - query() - Check that our contract will revert with an invalid endpoint", async function () {
        await prepareTokens.call(this.test, subscriber);

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});

        await expect(this.test.subscriber.testQuery(oracleAddr, query, "Bad Endpoint", params)).to.be.eventually.rejectedWith(EVMRevert);
    });


    it("DISPATCH_5 - query() - Check that our test contract can bond and make queries to different endpoints", async function () {
        await prepareTokens.call(this.test, subscriber);

        const subscriberEvents = this.test.subscriber.allEvents({ fromBlock: 0, toBlock: 'latest' });
        subscriberEvents.watch((err, res) => { }); 

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        // Bond to endpoints 1-3
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec2, 100, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec3, 100, {from: subscriber});

        // Make three separate queries
        await this.test.subscriber.testQuery(oracleAddr, query, spec1, params);
        let logs = await subscriberEvents.get();
        await expect(isEventReceived(logs, "Result1")).to.be.equal(true);
        var result = logs[0].args["response1"];
        await expect(result == "Hello World");

        await this.test.subscriber.testQuery(oracleAddr, "test", spec2, params);
        logs = await subscriberEvents.get();
        result = logs[1].args["response1"];
        await expect(result == "tset");

        // STOP WATCHING EVENTS
        subscriberEvents.stopWatching();
    });

    it("DISPATCH_6 - Check that dispatch will revert if subscriber is subscribed to a different endpoint", async function () {
        await prepareTokens.call(this.test, subscriber);    

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});

        await expect(this.test.subscriber.testQuery(oracleAddr, query, spec2, params)).to.be.eventually.rejectedWith(EVMRevert);
    });


    it("DISPATCH_7 - query() - Check that the test oracle can access the given endpoint parameters and use respondBytes32Array", async function () {
        await prepareTokens.call(this.test, subscriber);    

        const subscriberEvents = this.test.subscriber.allEvents({ fromBlock: 0, toBlock: 'latest' });
        subscriberEvents.watch((err, res) => { }); 

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec3, 100, {from: subscriber});

        let params3 = [toHex(1), toHex(2), toHex(3)]; 

        await this.test.subscriber.testQuery(oracleAddr, query, spec3, params3);

        let logs = await subscriberEvents.get();
        await expect(isEventReceived(logs, "Result1")).to.be.equal(true);
        var result = logs[0].args["response1"];
        var sum = web3.toDecimal(result);

        await expect(sum).to.be.equal(6);
    });

    it("DISPATCH_8 - Dispatch will revert if query has already been fulfilled", async function () {
        await prepareTokens.call(this.test, subscriber);    

        const subscriberEvents = this.test.subscriber.allEvents({ fromBlock: 0, toBlock: 'latest' });
        subscriberEvents.watch((err, res) => { }); 

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec1, 100, {from: subscriber});

        await this.test.subscriber.testQuery(oracleAddr, query, spec1, params);

        let logs = await subscriberEvents.get();
        await expect(isEventReceived(logs, "Result1")).to.be.equal(true);

        // get id from the Result1 event
        var id = new BigNumber(logs[0].args["id"]);

        // call respond() on already fulfilled query
        await expect(this.test.dispatch.respond1(id, "Bad Data")).to.be.eventually.rejectedWith(EVMRevert);
    });

    it("DISPATCH_9 - respond2() - Check that we can receive two return values", async function () {
        await prepareTokens.call(this.test, subscriber);    

        const subscriberEvents = this.test.subscriber.allEvents({ fromBlock: 0, toBlock: 'latest' });
        subscriberEvents.watch((err, res) => { }); 

        var oracleAddr = this.test.oracle.address;
        var subAddr = this.test.subscriber.address; 

        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.delegateBond(subAddr, oracleAddr, spec4, 100, {from: subscriber});

        await this.test.subscriber.testQuery(oracleAddr, query, spec4, params);

        let logs = await subscriberEvents.get();
        await expect(isEventReceived(logs, "Result1")).to.be.equal(true);

        // subscriber should have emitted one event
        var r1 = logs[0].args["response1"];
        var r2 = logs[0].args["response2"];

        await expect(r1).to.be.equal("Hello");
        await expect(r2).to.be.equal("World");

        await expect(this.test.dispatch.respond1(id, "Bad Data")).to.be.eventually.rejectedWith(EVMRevert);
    });

    // converts an integer to its 32-bit hex representation
    function toHex(num){
        var hex = web3.toHex(num).substring(2);
          while (hex.length < 64) hex = "0" + hex;
        hex = "0x" + hex;
        return hex; 
    }
}); 
