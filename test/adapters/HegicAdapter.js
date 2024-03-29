const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  BN,
  ether,
  constants,
  time,
  expectRevert,
  expectEvent,
  balance,
} = require("@openzeppelin/test-helpers");
const { assert } = require("chai");
const helper = require("../helper.js");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockDojiFactory = contract.fromArtifact("MockDojiFactory");
const IHegicETHOptions = contract.fromArtifact("IHegicETHOptions");
const IHegicBTCOptions = contract.fromArtifact("IHegicBTCOptions");
const IERC20 = contract.fromArtifact("IERC20");

const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const [admin, owner, user, recipient] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("HegicAdapter", () => {
  let initSnapshotId, snapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    this.protocolName = "HEGIC";
    this.nonFungible = true;

    // we assume the user account is the calling instrument
    this.factory = await MockDojiFactory.new({ from: owner });
    await this.factory.setInstrument(user, { from: user });

    this.adapter = await HegicAdapter.new(
      HEGIC_ETH_OPTIONS,
      HEGIC_WBTC_OPTIONS,
      ETH_ADDRESS,
      WBTC_ADDRESS
    );
    await this.adapter.initialize(owner, this.factory.address);

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
  });

  describe("#protocolName", () => {
    it("matches the protocol name", async function () {
      assert.equal(await this.adapter.protocolName(), this.protocolName);
    });
  });

  describe("#nonFungible", () => {
    it("matches the nonFungible bool", async function () {
      assert.equal(await this.adapter.nonFungible(), this.nonFungible);
    });
  });

  /**
   * Current price for ETH-USD = ~$545
   * Current price for BTC-USD = ~$18,000
   */

  // ETH Options
  behavesLikeHegicOptions({
    optionName: "ETH CALL ITM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("500"),
    premium: new BN("130759818438591130"),
    purchaseAmount: ether("1"),
    optionType: CALL_OPTION_TYPE,
    expectedOptionID: "1685",
    exerciseProfit: new BN("86680823070678630"),
  });

  behavesLikeHegicOptions({
    optionName: "ETH CALL OTM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("600"),
    premium: new BN("38399162806593750"),
    purchaseAmount: ether("1"),
    optionType: CALL_OPTION_TYPE,
    expectedOptionID: "1685",
    exerciseProfit: new BN("0"),
  });

  behavesLikeHegicOptions({
    optionName: "ETH PUT ITM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("600"),
    premium: new BN("140095483573495796"),
    purchaseAmount: ether("1"),
    optionType: PUT_OPTION_TYPE,
    expectedOptionID: "1685",
    exerciseProfit: new BN("95983012315185643"),
  });

  behavesLikeHegicOptions({
    optionName: "ETH PUT OTM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("500"),
    premium: new BN("38427059381925127"),
    purchaseAmount: ether("1"),
    optionType: PUT_OPTION_TYPE,
    expectedOptionID: "1685",
    exerciseProfit: new BN("0"),
  });

  // WBTC Options
  behavesLikeHegicOptions({
    optionName: "WBTC CALL ITM",
    underlying: WBTC_ADDRESS,
    strikeAsset: WBTC_ADDRESS,
    strikePrice: ether("17000"),
    premium: new BN("3245932593862604696"),
    purchaseAmount: new BN("100000000"),
    optionType: CALL_OPTION_TYPE,
    expectedOptionID: "804",
    exerciseProfit: new BN("6541306"),
  });

  behavesLikeHegicOptions({
    optionName: "WBTC CALL OTM",
    underlying: WBTC_ADDRESS,
    strikeAsset: WBTC_ADDRESS,
    strikePrice: ether("19000"),
    premium: new BN("993071208326308189"),
    purchaseAmount: new BN("100000000"),
    optionType: CALL_OPTION_TYPE,
    expectedOptionID: "804",
    exerciseProfit: new BN("0"),
  });

  behavesLikeHegicOptions({
    optionName: "WBTC PUT ITM",
    underlying: WBTC_ADDRESS,
    strikeAsset: WBTC_ADDRESS,
    strikePrice: ether("19000"),
    premium: new BN("2534225943323958120"),
    purchaseAmount: new BN("100000000"),
    optionType: PUT_OPTION_TYPE,
    expectedOptionID: "804",
    exerciseProfit: new BN("4453833"),
  });

  behavesLikeHegicOptions({
    optionName: "WBTC PUT OTM",
    underlying: WBTC_ADDRESS,
    strikeAsset: WBTC_ADDRESS,
    strikePrice: ether("17000"),
    premium: new BN("977357655115998008"),
    purchaseAmount: new BN("100000000"),
    optionType: PUT_OPTION_TYPE,
    expectedOptionID: "804",
    exerciseProfit: new BN("0"),
  });

  function behavesLikeHegicOptions(params) {
    describe(`${params.optionName}`, () => {
      before(async function () {
        const {
          underlying,
          strikeAsset,
          expiry,
          strikePrice,
          premium,
          purchaseAmount,
          optionType,
          expectedOptionID,
          exerciseProfit,
        } = params;
        this.underlying = underlying;
        this.strikeAsset = strikeAsset;
        this.startTime = (await web3.eth.getBlock("latest")).timestamp;
        this.expiry = expiry || this.startTime + 60 * 60 * 24 * 2; // 2 days from now
        this.strikePrice = strikePrice;
        this.premium = premium;
        this.purchaseAmount = purchaseAmount;
        this.optionType = optionType;
        this.expectedOptionID = expectedOptionID;
        this.exerciseProfit = exerciseProfit;
        this.hegicOptions = await getOptionsContract(this.underlying);
      });

      describe("#premium", () => {
        it("gets premium of option", async function () {
          const premium = await this.adapter.premium(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount
          );
          assert.equal(premium.toString(), this.premium.toString());
        });
      });

      describe("#purchase", () => {
        beforeEach(async () => {
          const snapShot = await helper.takeSnapshot();
          snapshotId = snapShot["result"];
        });

        afterEach(async () => {
          await helper.revertToSnapShot(snapshotId);
        });

        it("reverts when not enough value is passed", async function () {
          await expectRevert(
            this.adapter.purchase(
              this.underlying,
              this.strikeAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.purchaseAmount,
              {
                from: user,
                value: this.premium.sub(new BN("1")),
              }
            ),
            "Value does not cover cost"
          );
        });

        it("reverts when buying after expiry", async function () {
          await time.increaseTo(this.expiry + 1);

          await expectRevert(
            this.adapter.purchase(
              this.underlying,
              this.strikeAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.purchaseAmount,
              {
                from: user,
                value: this.premium,
              }
            ),
            "Cannot purchase after expiry"
          );
        });

        it("reverts when passing unknown underlying", async function () {
          await expectRevert(
            this.adapter.purchase(
              "0x0000000000000000000000000000000000000001",
              this.strikeAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.purchaseAmount,
              {
                from: user,
                value: this.purchaseAmount,
              }
            ),
            "No matching underlying"
          );
        });

        it("creates options on hegic", async function () {
          const res = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );

          expectEvent(res, "Purchased", {
            protocolName: web3.utils.sha3("HEGIC"),
            underlying: this.underlying,
            strikeAsset: this.strikeAsset,
            expiry: this.expiry.toString(),
            strikePrice: this.strikePrice,
            optionType: this.optionType.toString(),
            amount: this.purchaseAmount,
            premium: this.premium,
            optionID: this.expectedOptionID,
          });

          assert.equal(
            (await this.adapter.totalOptions(user)).toString(),
            this.purchaseAmount
          );

          const {
            holder,
            strike,
            amount,
            lockedAmount,
            premium,
            expiration,
            optionType,
          } = await this.hegicOptions.options(this.expectedOptionID);

          // strike price is scaled down to 10**8 from 10**18
          const scaledStrikePrice = this.strikePrice.div(new BN("10000000000"));

          const { settlementFee } = await this.hegicOptions.fees(
            this.expiry - this.startTime,
            this.purchaseAmount,
            scaledStrikePrice,
            this.optionType
          );
          assert.equal(holder, this.adapter.address);
          assert.equal(strike.toString(), scaledStrikePrice);
          assert.equal(amount.toString(), this.purchaseAmount);
          assert.equal(lockedAmount.toString(), this.purchaseAmount);
          assert.equal(expiration, this.expiry);
          assert.equal(optionType, this.optionType);

          // premiums for token options are denominated in the underlying token
          // we only check for this case when underlying is ETH
          if (this.underlying == ETH_ADDRESS) {
            assert.equal(
              premium.toString(),
              this.premium.sub(settlementFee).toString()
            );
          }
        });
      });

      describe("#exerciseProfit", () => {
        beforeEach(async function () {
          const snapShot = await helper.takeSnapshot();
          snapshotId = snapShot["result"];
        });

        afterEach(async () => {
          await helper.revertToSnapShot(snapshotId);
        });

        it("reverts when unknown options address passed", async function () {
          await expectRevert(
            this.adapter.exerciseProfit(constants.ZERO_ADDRESS, 0, 0),
            "optionsAddress must match either ETH or WBTC options"
          );
        });

        it("gets correct exercise profit for an option", async function () {
          const purchaseRes = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );

          assert.equal(
            (
              await this.adapter.exerciseProfit(
                this.hegicOptions.address,
                purchaseRes.receipt.logs[0].args.optionID,
                0
              )
            ).toString(),
            this.exerciseProfit
          );
        });
      });

      describe("#exercise", () => {
        beforeEach(async function () {
          const snapShot = await helper.takeSnapshot();
          snapshotId = snapShot["result"];

          const purchaseRes = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );
          this.optionID = purchaseRes.receipt.logs[0].args.optionID;
        });

        afterEach(async () => {
          await helper.revertToSnapShot(snapshotId);
        });

        it("reverts when exercising over options capacity", async function () {
          await this.factory.setInstrument(owner, { from: owner });

          const premium = await this.adapter.premium(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount.add(new BN("1"))
          );

          const purchaseRes = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount.add(new BN("1")),
            {
              from: owner,
              value: premium,
            }
          );
          const optionID = purchaseRes.receipt.logs[0].args.optionID;

          await expectRevert(
            this.adapter.exercise(
              this.hegicOptions.address,
              optionID,
              0,
              user,
              { from: user, gasPrice }
            ),
            "Cannot exercise over capacity"
          );
        });

        if (params.exerciseProfit.isZero()) {
          it("reverts when not ITM", async function () {
            await expectRevert(
              this.adapter.exercise(
                this.hegicOptions.address,
                this.optionID,
                0,
                user,
                { from: user, gasPrice }
              ),
              `Current price is too ${this.optionType === 1 ? "high" : "low"}`
            );
          });
        } else {
          it("exercises options with profit", async function () {
            const userTracker = await balance.tracker(user);
            let token, startUserBalance;
            if (this.underlying !== ETH_ADDRESS) {
              token = await IERC20.at(this.underlying);
              startUserBalance = await token.balanceOf(user);
            }

            const res = await this.adapter.exercise(
              this.hegicOptions.address,
              this.optionID,
              0,
              user,
              { from: user, gasPrice }
            );
            expectEvent(res, "Exercised", {
              caller: user,
              optionID: this.expectedOptionID,
              amount: "0",
              exerciseProfit: this.exerciseProfit,
            });

            assert.equal(
              (await this.adapter.totalOptions(user)).toString(),
              "0"
            );

            if (this.underlying === ETH_ADDRESS) {
              const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
              const profit = this.exerciseProfit.sub(gasFee);
              assert.equal(
                (await userTracker.delta()).toString(),
                profit.toString()
              );

              // make sure the adapter doesn't accidentally retain any ether
              assert.equal(
                (await balance.current(this.adapter.address)).toString(),
                "0"
              );
            } else {
              assert.equal(
                (await token.balanceOf(user)).sub(startUserBalance).toString(),
                this.exerciseProfit
              );
              assert.equal(
                (await token.balanceOf(this.adapter.address)).toString(),
                "0"
              );
            }
          });

          it("redirects exercise profit to recipient", async function () {
            const recipientTracker = await balance.tracker(recipient);
            let token, startRecipientBalance;
            if (this.underlying !== ETH_ADDRESS) {
              token = await IERC20.at(this.underlying);
              startRecipientBalance = await token.balanceOf(recipient);
            }

            await this.adapter.exercise(
              this.hegicOptions.address,
              this.optionID,
              0,
              recipient,
              { from: user, gasPrice }
            );

            if (this.underlying === ETH_ADDRESS) {
              assert.equal(
                (await recipientTracker.delta()).toString(),
                this.exerciseProfit.toString() // gas fee not subtracted from recipient
              );

              // make sure the adapter doesn't accidentally retain any ether
              assert.equal(
                (await balance.current(this.adapter.address)).toString(),
                "0"
              );
            } else {
              assert.equal(
                (await token.balanceOf(recipient))
                  .sub(startRecipientBalance)
                  .toString(),
                this.exerciseProfit
              );
              assert.equal(
                (await token.balanceOf(this.adapter.address)).toString(),
                "0"
              );
            }
          });

          it("reverts when exercising twice", async function () {
            await this.adapter.exercise(
              this.hegicOptions.address,
              this.optionID,
              0,
              user,
              {
                from: user,
              }
            );
            await expectRevert(
              this.adapter.exercise(
                this.hegicOptions.address,
                this.optionID,
                0,
                user,
                {
                  from: user,
                }
              ),
              "Cannot exercise over capacity"
            );
          });
        }

        it("reverts when past expiry", async function () {
          await time.increaseTo(this.expiry + 1);

          await expectRevert(
            this.adapter.exercise(
              this.hegicOptions.address,
              this.optionID,
              0,
              user,
              {
                from: user,
              }
            ),
            "Option has expired"
          );
        });
      });
    });
  }

  async function getOptionsContract(underlying) {
    if (underlying === ETH_ADDRESS) {
      return await IHegicETHOptions.at(HEGIC_ETH_OPTIONS);
    } else if (underlying === WBTC_ADDRESS) {
      return await IHegicBTCOptions.at(HEGIC_WBTC_OPTIONS);
    }
    throw new Error(`No underlying found ${underlying}`);
  }
});
