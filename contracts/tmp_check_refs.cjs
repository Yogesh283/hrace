const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(
  'https://bsc-testnet-rpc.publicnode.com',
  { chainId: 97, name: 'bsct' },
  { staticNetwork: true },
);

const ENG = '0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef';
const abi = [
  'event CommunityReferralPaid(address indexed sponsor, address indexed from, uint256 level, uint256 usdtValue, uint256 racePaid)',
  'event ICOStakeCreated(address indexed buyer, uint256 indexed stakeIndex, uint256 indexed icoPurchaseId, uint256 usdtPaid, uint256 raceAmount, uint256 lockPeriod, uint256 dailyRateBps, uint256 unlockAt)',
  'event MemberActivated(address indexed user, address indexed referrer, uint256 timestamp)',
  'function isParticipationActive(address) view returns (bool)',
  'function referrerOf(address) view returns (address)',
  'function stakeCount(address) view returns (uint256)',
];

(async () => {
  const c = new ethers.Contract(ENG, abi, provider);
  const latest = await provider.getBlockNumber();
  console.log('block', latest);
  const from = Math.max(0, latest - 30000);

  const stakes = await c.queryFilter(c.filters.ICOStakeCreated(), from, latest);
  console.log('ICOStakeCreated_count', stakes.length);

  const refs = await c.queryFilter(c.filters.CommunityReferralPaid(), from, latest);
  console.log('CommunityReferralPaid_count', refs.length);

  for (const e of stakes.slice(-10)) {
    const buyer = e.args.buyer;
    const ref = await c.referrerOf(buyer);
    const active = await c.isParticipationActive(buyer);
    const sameTxRefs = refs.filter((r) => r.transactionHash === e.transactionHash);
    console.log(
      JSON.stringify({
        buyer,
        usdt: ethers.formatEther(e.args.usdtPaid),
        icoId: e.args.icoPurchaseId.toString(),
        stake: e.args.stakeIndex.toString(),
        referrer: ref,
        buyerActive: active,
        referralEventsInTx: sameTxRefs.length,
        tx: e.transactionHash,
        block: e.blockNumber,
      }),
    );
    for (const r of sameTxRefs) {
      console.log(
        '  REF',
        JSON.stringify({
          sponsor: r.args.sponsor,
          level: r.args.level.toString(),
          usdt: ethers.formatEther(r.args.usdtValue),
          race: ethers.formatEther(r.args.racePaid),
        }),
      );
    }
  }

  // Known wallets from earlier chat
  const samples = [
    '0x45FC20CdC8c36F69b02C4a6107C80805aDd9066f',
    '0x324a0c3d232f0f2a2f3ac16c429303adfe2033a8',
  ];
  for (const w of samples) {
    console.log(
      JSON.stringify({
        wallet: w,
        referrer: await c.referrerOf(w),
        active: await c.isParticipationActive(w),
        stakes: (await c.stakeCount(w)).toString(),
      }),
    );
  }
})().catch((e) => console.error(e.shortMessage || e.message || e));
