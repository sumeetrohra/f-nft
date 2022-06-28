// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract FToken is ERC20, Ownable, ERC20Permit, ERC721Holder {
    IERC721 public collection;
    uint256 public tokenId;
    bool public initialized = false;
    bool public forSale = false;
    uint256 public salePrice;
    bool public canRedeem = false;

    constructor() ERC20("FToken", "FNFT") ERC20Permit("FToken") {}

    function initialize(address _collection, uint256 _tokenId) external payable onlyOwner {
        require(!initialized, "Already Initialized");
        collection = IERC721(_collection);
        tokenId = _tokenId;
        initialized = true;
        collection.safeTransferFrom(msg.sender, address(this), tokenId);
        _mint(msg.sender, 1000000);
    }

    function putForSale(uint256 price) external onlyOwner {
        require(price > 0, "Price cannot be 0 or less than 0");
        salePrice = price;
        forSale = true;
    }

    function purchase() external payable {
        require(forSale, "Not for sale");
        require(msg.value >= salePrice, "Not enough ethers sent");
        forSale = false;
        canRedeem = true;
        collection.safeTransferFrom(address(this), msg.sender, tokenId);
    }

    function redeem(uint256 _amount) external {
        require(canRedeem, "Redemption not available");
        uint256 totalEthers = address(this).balance;
        uint256 toRedeem = _amount * totalEthers / totalSupply();
        _burn(msg.sender, _amount);
        (bool success, ) = payable(msg.sender).call{value: toRedeem}("");
        require(success);
    }
}
