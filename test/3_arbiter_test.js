// import EVMRevert from './helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const expect = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .expect;

const Utils = require('./helpers/utils.js');

const Arbiter = artifacts.require("Arbiter");
const ArbiterStorage = artifacts.require("ArbiterStorage");
const Bondage = artifacts.require("Bondage");
const BondageStorage = artifacts.require("BondageStorage");
const Registry = artifacts.require("Registry");
const RegistryStorage = artifacts.require("RegistryStorage");
const TheToken = artifacts.require("TheToken");

contract('Arbiter', function (accounts) {
    const owner = accounts[0];
    const subscriber = accounts[1];
    const oracle = accounts[2];

    const publicKey = 111;
    const title = "test";
    const routeKeys = [1];
    const params = ["param1", "param2"];

    const specifier = "test-specifier";
    const curveLinear = Utils.CurveTypes["Linear"];
    const start = 1;
    const mul = 2;

    const tokensForOwner = new BigNumber("1500e18");
    const tokensForSubscriber = new BigNumber("5000e18");
    const approveTokens = new BigNumber("1000e18");

    async function prepareProvider() {
        await this.registry.initiateProvider(publicKey, title, specifier, params, { from: oracle });
        await this.registry.initiateProviderCurve(specifier, curveLinear, start, mul, { from: oracle });
    }

    async function prepareTokens() {
        await this.token.allocate(owner, tokensForOwner, { from: owner });
        await this.token.allocate(subscriber, tokensForSubscriber, { from: owner });
        //await this.token.approve(this.bondage.address, approveTokens, {from: subscriber});
    }

    beforeEach(async function deployContracts() {
        this.currentTest.regStor = await RegistryStorage.new();
        this.currentTest.registry = await Registry.new(this.currentTest.regStor.address);
        this.currentTest.regStor.transferOwnership(this.currentTest.registry.address);

        this.currentTest.token = await TheToken.new();

        this.currentTest.bondStor = await BondageStorage.new();
        this.currentTest.bondage = await Bondage.new(this.currentTest.bondStor.address, this.currentTest.registry.address, this.currentTest.token.address);
        this.currentTest.bondStor.transferOwnership(this.currentTest.bondage.address);

        this.currentTest.arbStor = await ArbiterStorage.new();
        this.currentTest.arbiter = await Arbiter.new(this.currentTest.arbStor.address, this.currentTest.bondage.address);
        this.currentTest.arbStor.transferOwnership(this.currentTest.arbiter.address);
    });

    it("ARBITER_1 - initiateSubscription() - Check subscription", async function () {
        prepareProvider.call(this.test);
        prepareTokens.call(this.test);
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});

        await this.test.bondage.bond(oracle, specifier, 1000, {from: subscriber});

        await this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 10, {from: subscriber});

        const res = await this.test.arbiter.getSubscription.call(oracle, subscriber, specifier);
        expect(parseInt(res[0].valueOf())).to.be.equal(10);
    });

    it("ARBITER_2 - initiateSubscription() - Check subscription block must be more than 0", async function () {
        prepareProvider.call(this.test);
        prepareTokens.call(this.test);
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});

        await this.test.bondage.bond(oracle, specifier, 1000, {from: subscriber});

        expect(this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 0, {from: subscriber})).to.eventually.be.rejectedWith(EVMRevert);
    });

    it("ARBITER_3 - initiateSubscription() - Check user can inititate subscription for same subscriber once", async function () {
        prepareProvider.call(this.test);
        prepareTokens.call(this.test);
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.bond(oracle, specifier, 1000, {from: subscriber});

        this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 10, {from: subscriber});

        const res = await this.test.arbiter.getSubscription.call(oracle, subscriber, specifier);
        expect(parseInt(res[0].valueOf())).to.be.equal(10);

        expect(this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 5, {from: subscriber})).to.eventually.be.rejectedWith(EVMRevert);
    });

// REFACTOR 4/5 taking into considerations that there are 2 ways to end a subscription
// endSubscriptionsubscriber() or endSubscriptionSubscriber()

    it("ARBITER_4 - endSubscription() - Check ending subscription", async function () {
        prepareProvider.call(this.test);
        prepareTokens.call(this.test);
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.bond(oracle, specifier, 1000, {from: subscriber});

        await this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 10, {from: subscriber});

        let res = await this.test.arbiter.getSubscription.call(oracle, subscriber, specifier);
        expect(parseInt(res[0].valueOf())).to.be.equal(10);

        await this.test.arbiter.endSubscription(specifier, subscriber, owner);

        res = await this.test.arbiter.getSubscription.call(oracle, subscriber, specifier);
        expect(parseInt(res[0].valueOf())).to.be.equal(0);
    });

    it("ARBITER_5 - endSubscription() - Check that user can't end uninitialized subscription", async function () {
        prepareProvider.call(this.test);
        prepareTokens.call(this.test);
        await this.test.token.approve(this.test.bondage.address, approveTokens, {from: subscriber});
        await this.test.bondage.bond(oracle, specifier, 1000, {from: subscriber});

        //await this.test.arbiter.initiateSubscription(oracle, params, specifier, publicKey, 10, {from: subscriber});

        expect(this.test.arbiter.endSubscription(specifier, subscriber, owner)).to.eventually.be.rejectedWith(EVMRevert);
    });
});