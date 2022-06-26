const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("F-NFT", async () => {
  let minter, buyer, nftContract, fTokenContract;
  const tokenId = 1;

  before(async () => {
    let signers = await ethers.getSigners();
    minter = signers[0];
    buyer = signers[1];
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

  it("Should set ERC20 token is the operator for the NFT", async () => {
    await nftContract
      .connect(minter)
      .setApprovalForAll(fTokenContract.address, true);
    const isApproved = await nftContract.isApprovedForAll(
      minter.address,
      fTokenContract.address
    );
    expect(isApproved).to.equals(true);
  });

  it("Fractionalizes NFT and gives 10,00,000 erc20 tokens to the owner", async () => {
    await fTokenContract.initialize(nftContract.address, tokenId);
    const erc20Bal = await fTokenContract.balanceOf(minter.address);
    const nftOwner = await nftContract.ownerOf(tokenId);
    expect(nftOwner).to.equals(fTokenContract.address);
    expect(erc20Bal).to.equals(1000000);
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

  it("Buyer gets the NFT Token and the seller has the 10,00,000 ERC20 Tokens to redeem for 10 ethers later if it pays more than or equal to 10 ethers", async () => {
    const tx = await fTokenContract
      .connect(buyer)
      .purchase({ value: ethers.utils.parseEther("10") });
    const nftOwner = await nftContract.ownerOf(1);
    const buyerErc20Bal = await fTokenContract.balanceOf(buyer.address);
    const minterErc20Bal = await fTokenContract.balanceOf(minter.address);
    const etherBalanceOfTokenContract = await ethers.provider.getBalance(
      fTokenContract.address
    );
    expect(etherBalanceOfTokenContract).to.equals("10000000000000000000");
    expect(nftOwner).to.equals(buyer.address);
    expect(buyerErc20Bal).to.equals(0);
    expect(minterErc20Bal).to.equals(1000000);
  });

  it("Minter can redeem erc20 tokens for 10 ethers", async () => {
    const initial = (
      await ethers.provider.getBalance(minter.address)
    ).toString();
    const iniBal = Number(initial.slice(0, initial.length - 18));

    await expect(fTokenContract.connect(minter).redeem(1000000)).to.not.be
      .reverted;

    const final = (await ethers.provider.getBalance(minter.address)).toString();
    const finBal = Number(final.slice(0, final.length - 18));

    expect(finBal).to.equals(iniBal + 10);
  });
});
