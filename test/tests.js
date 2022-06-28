const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("F-NFT", async () => {
  let minter, buyer, nftContract, fTokenContract, receiver;
  const tokenId = 1;

  before(async () => {
    let signers = await ethers.getSigners();
    minter = signers[0];
    buyer = signers[1];
    receiver = signers[2];
    const NFT = await ethers.getContractFactory("MyNFT");
    nftContract = await NFT.connect(minter).deploy();
    await nftContract.deployed();

    const FToken = await ethers.getContractFactory("FToken");
    fTokenContract = await FToken.connect(minter).deploy();
    await fTokenContract.deployed();
  });

  it("Only the minter(owner) can mint the NFT", async () => {
    await expect(
      nftContract.connect(buyer).safeMint(buyer.address, tokenId)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Mints NFT", async () => {
    await nftContract.connect(minter).safeMint(minter.address, tokenId);
    const nftOwner = await nftContract.ownerOf(tokenId);
    await expect(nftOwner).to.equals(minter.address);
  });

  it("Should set ERC20 token as the operator for the NFT", async () => {
    await nftContract
      .connect(minter)
      .setApprovalForAll(fTokenContract.address, true);
    const isApproved = await nftContract.isApprovedForAll(
      minter.address,
      fTokenContract.address
    );
    expect(isApproved).to.equals(true);
  });

  it("Fractionalizes NFT and gives 10,00,000 erc20 tokens to the minter", async () => {
    await fTokenContract.initialize(nftContract.address, tokenId);
    const erc20Bal = await fTokenContract.balanceOf(minter.address);
    expect(erc20Bal).to.equals(1000000);

    const nftOwner = await nftContract.ownerOf(tokenId);
    expect(nftOwner).to.equals(fTokenContract.address);
  });

  it("Minter can transfer half tokens to receiver", async () => {
    await fTokenContract.transfer(receiver.address, 500000);
    const bal = await fTokenContract.balanceOf(receiver.address);
    expect(bal).to.equals(500000);
  });

  it("Contract balance should be 0", async () => {
    const contractBal = await ethers.provider.getBalance(
      fTokenContract.address
    );
    expect(contractBal).to.equals(0);
  });

  it("No one can purchase, if its not put for sale", async () => {
    await expect(
      fTokenContract
        .connect(buyer)
        .purchase({ value: ethers.utils.parseEther("10") })
    ).to.be.revertedWith("Not for sale");
  });

  it("Should put 10 ethers as sale price", async () => {
    const salePrice = 10000000000000000000; // 10 ethers;
    await fTokenContract
      .connect(minter)
      .putForSale(ethers.utils.parseEther("10"));
    const forSale = await fTokenContract.forSale();
    const price = await fTokenContract.salePrice();
    expect(forSale).to.equals(true);
    expect(price).to.equals(salePrice.toString());
  });

  it("Buyer should not be able to purchase for less than sale Price", async () => {
    await expect(
      fTokenContract
        .connect(buyer)
        .purchase({ value: ethers.utils.parseEther("1") })
    ).to.be.revertedWith("Not enough ethers sent");
  });

  it("Buyer can purchase the NFT for 10 ethers or more", async () => {
    const tx = await fTokenContract
      .connect(buyer)
      .purchase({ value: ethers.utils.parseEther("10") });
    const nftOwner = await nftContract.ownerOf(1);
    const buyerErc20Bal = await fTokenContract.balanceOf(buyer.address);
    const etherBalanceOfTokenContract = await ethers.provider.getBalance(
      fTokenContract.address
    );
    expect(etherBalanceOfTokenContract).to.equals("10000000000000000000");
    expect(nftOwner).to.equals(buyer.address);
    expect(buyerErc20Bal).to.equals(0);
  });

  it("Contract balance after purchase should be 10 ethers", async () => {
    const contractBal = await ethers.provider
      .getBalance(fTokenContract.address)
      .then((data) => data.toString());
    expect(contractBal.slice(0, contractBal.length - 18)).to.equals("10");
  });

  it("Minter can redeem remaining half erc20 tokens for 5 ethers", async () => {
    const initialMinter = (
      await ethers.provider.getBalance(minter.address)
    ).toString();
    const initMinterBal = Number(
      initialMinter.slice(0, initialMinter.length - 18)
    );

    await expect(fTokenContract.connect(minter).redeem(500000)).to.not.be
      .reverted;

    const finalMinter = (
      await ethers.provider.getBalance(minter.address)
    ).toString();
    const finMinterBal = Number(finalMinter.slice(0, finalMinter.length - 18));

    expect(finMinterBal).to.equals(initMinterBal + 5);
  });

  it("Receiver can redeem the other half erc20 tokens for 5 ethers", async () => {
    const initialReceiver = (
      await ethers.provider.getBalance(receiver.address)
    ).toString();
    const initReceiverBal = Number(
      initialReceiver.slice(0, initialReceiver.length - 18)
    );

    await expect(fTokenContract.connect(receiver).redeem(500000)).to.not.be
      .reverted;

    const finalReceiver = (
      await ethers.provider.getBalance(receiver.address)
    ).toString();
    const finalReceiverBal = Number(
      finalReceiver.slice(0, finalReceiver.length - 18)
    );

    expect(finalReceiverBal).to.greaterThanOrEqual(initReceiverBal + 4);
  });
});
