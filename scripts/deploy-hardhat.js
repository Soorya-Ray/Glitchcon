const fs = require('fs');
const path = require('path');

async function main() {
  const EscrowContract = await ethers.getContractFactory('EscrowContract');
  const contract = await EscrowContract.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const [deployer] = await ethers.getSigners();

  const outDir = path.join(__dirname, '..', 'hardhat');
  fs.mkdirSync(outDir, { recursive: true });

  const deployment = {
    network: hre.network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };

  const outPath = path.join(outDir, 'deployment.local.json');
  fs.writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`EscrowContract deployed to: ${contractAddress}`);
  console.log(`Deployment metadata written to: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
