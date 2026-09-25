import MemberAlert from '@/Components/Member/MemberAlert';
import MemberPageHero from '@/Components/Member/MemberPageHero';
import MemberPageShell from '@/Components/Member/MemberPageShell';
import PanelCard from '@/Components/PanelCard';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { getWalletProvider } from '@/lib/web3Wallet';
import { BrowserProvider, Contract, JsonRpcProvider, id as keccakId } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';

const GOV_ABI = [
    'function memberCount() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function votingPeriod() view returns (uint256)',
    'function timelockDelay() view returns (uint256)',
    'function getMembers() view returns (address[])',
    'function isMember(address) view returns (bool)',
    'function proposalCount() view returns (uint256)',
    'function getProposal(uint256) view returns (address,uint256,bytes32,address,uint64,uint64,uint64,uint64,uint256,uint256,bool,bool,bool)',
    'function state(uint256) view returns (uint8)',
    'function hasVoted(uint256,address) view returns (bool)',
    'function castVote(uint256,bool)',
    'function queue(uint256)',
    'function execute(uint256)',
];

const STATE_LABELS = [
    'Pending',
    'Active',
    'Defeated',
    'Succeeded',
    'Queued',
    'Executed',
    'Cancelled',
    'Expired',
];

function shortAddr(a) {
    if (!a || a.length < 12) return a || '—';
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function Governance({ governance }) {
    const { auth } = usePage().props;
    const cfg = governance ?? {};
    const [wallet, setWallet] = useState('');
    const [meta, setMeta] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    const address = cfg.address || '';
    const configured = Boolean(cfg.configured);

    const connect = useCallback(async () => {
        setError('');
        if (!getWalletProvider()) {
            setError('Connect any EVM crypto wallet first');
            return;
        }
        const provider = new BrowserProvider(getWalletProvider());
        const accounts = await provider.send('eth_requestAccounts', []);
        setWallet(accounts[0] || '');
    }, []);

    const load = useCallback(async () => {
        if (!configured || !address) return;
        setError('');
        try {
            const provider = getWalletProvider()
                ? new BrowserProvider(getWalletProvider())
                : cfg.rpc_url
                  ? new JsonRpcProvider(cfg.rpc_url)
                  : null;
            if (!provider) {
                setError('Connect wallet or configure RPC to load on-chain governance');
                return;
            }
            const gov = new Contract(address, GOV_ABI, provider);
            const [memberCount, threshold, votingPeriod, timelockDelay, members, proposalCount] =
                await Promise.all([
                    gov.memberCount(),
                    gov.threshold(),
                    gov.votingPeriod(),
                    gov.timelockDelay(),
                    gov.getMembers(),
                    gov.proposalCount(),
                ]);
            let isMember = false;
            if (wallet) {
                isMember = await gov.isMember(wallet);
            }
            setMeta({
                memberCount: Number(memberCount),
                threshold: Number(threshold),
                votingPeriod: Number(votingPeriod),
                timelockDelay: Number(timelockDelay),
                members,
                isMember,
                proposalCount: Number(proposalCount),
            });

            const rows = [];
            const n = Number(proposalCount);
            const start = Math.max(0, n - 20);
            for (let i = n - 1; i >= start; i--) {
                const p = await gov.getProposal(i);
                const st = Number(await gov.state(i));
                let voted = false;
                if (wallet) {
                    voted = await gov.hasVoted(i, wallet);
                }
                rows.push({
                    id: i,
                    target: p[0],
                    value: p[1].toString(),
                    descriptionHash: p[2],
                    proposer: p[3],
                    votingEnd: Number(p[6]),
                    eta: Number(p[7]),
                    forVotes: Number(p[8]),
                    againstVotes: Number(p[9]),
                    executed: p[10],
                    cancelled: p[11],
                    queued: p[12],
                    state: STATE_LABELS[st] || String(st),
                    voted,
                });
            }
            setProposals(rows);
        } catch (e) {
            setError(e?.shortMessage || e?.message || 'Failed to load governance');
        }
    }, [address, configured, wallet]);

    useEffect(() => {
        if (configured && wallet) {
            load();
        }
    }, [configured, wallet, load]);

    const vote = async (proposalId, support) => {
        setBusy(true);
        setError('');
        setStatus('');
        try {
            const provider = new BrowserProvider(getWalletProvider());
            const signer = await provider.getSigner();
            const gov = new Contract(address, GOV_ABI, signer);
            const tx = await gov.castVote(proposalId, support);
            await tx.wait();
            setStatus(`Vote ${support ? 'FOR' : 'AGAINST'} submitted on #${proposalId}`);
            await load();
        } catch (e) {
            setError(e?.shortMessage || e?.message || 'Vote failed');
        } finally {
            setBusy(false);
        }
    };

    const queueOrExecute = async (proposalId, fn) => {
        setBusy(true);
        setError('');
        setStatus('');
        try {
            const provider = new BrowserProvider(getWalletProvider());
            const signer = await provider.getSigner();
            const gov = new Contract(address, GOV_ABI, signer);
            const tx = await gov[fn](proposalId);
            await tx.wait();
            setStatus(`${fn} ok for #${proposalId}`);
            await load();
        } catch (e) {
            setError(e?.shortMessage || e?.message || `${fn} failed`);
        } finally {
            setBusy(false);
        }
    };

    const memberList = useMemo(() => meta?.members || [], [meta]);

    return (
        <AuthenticatedLayout pageTitle="Governance" memberSurface="race" showMobileFintechNav>
            <Head title="Community Governance" />
            <MemberPageShell contentClassName="space-y-5">
                <MemberPageHero
                    kicker="Protocol"
                    title="Community Governance"
                    variant="pdf"
                    icon="leadership"
                >
                    Wallet-based council (10–12). Separate from Multisig treasury 3-of-5. Description hash
                    example: {keccakId('example').slice(0, 18)}…
                </MemberPageHero>

                <p className="text-sm text-fintech-muted">{cfg.note}</p>
                {!configured ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        Set <code>RACE_GOVERNANCE_CONTRACT</code> in site .env after mainnet deploy.
                    </p>
                ) : (
                    <p className="break-all text-xs text-fintech-muted">
                        Contract: <strong className="text-fintech-ink">{address}</strong> · chain{' '}
                        {cfg.chain_id}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <PrimaryButton type="button" onClick={connect} disabled={busy}>
                        {wallet ? `Connected ${shortAddr(wallet)}` : 'Connect wallet'}
                    </PrimaryButton>
                    <PrimaryButton type="button" onClick={load} disabled={busy || !configured}>
                        Refresh on-chain
                    </PrimaryButton>
                </div>

                {error ? <MemberAlert variant="error">{error}</MemberAlert> : null}
                {status ? <MemberAlert variant="success">{status}</MemberAlert> : null}

                {meta ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <PanelCard title="Members" className="!p-4">
                            <p className="text-2xl font-bold">{meta.memberCount}</p>
                            <p className="text-xs text-fintech-muted">
                                You: {meta.isMember ? 'member' : 'not a member'}
                            </p>
                        </PanelCard>
                        <PanelCard title="Threshold" className="!p-4">
                            <p className="text-2xl font-bold">{meta.threshold}</p>
                        </PanelCard>
                        <PanelCard title="Voting period" className="!p-4">
                            <p className="text-2xl font-bold">{Math.round(meta.votingPeriod / 3600)}h</p>
                        </PanelCard>
                        <PanelCard title="Timelock" className="!p-4">
                            <p className="text-2xl font-bold">{Math.round(meta.timelockDelay / 3600)}h</p>
                        </PanelCard>
                    </div>
                ) : null}

                {memberList.length > 0 ? (
                    <PanelCard title="Governance members">
                        <ul className="space-y-1 font-mono text-xs">
                            {memberList.map((m) => (
                                <li key={m}>{m}</li>
                            ))}
                        </ul>
                    </PanelCard>
                ) : null}

                <PanelCard title={`Proposals (${meta?.proposalCount ?? 0})`}>
                    {proposals.length === 0 ? (
                        <p className="rx-empty">No proposals loaded yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {proposals.map((p) => (
                                <div
                                    key={p.id}
                                    className="rounded-lg border border-fintech-line bg-fintech-soft/40 p-3 text-sm"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <strong>#{p.id}</strong>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">
                                            {p.state}
                                        </span>
                                    </div>
                                    <p className="mt-1 break-all text-xs text-fintech-muted">
                                        Target: {p.target}
                                    </p>
                                    <p className="text-xs">
                                        For {p.forVotes} · Against {p.againstVotes} · Quorum via threshold
                                    </p>
                                    <p className="text-xs text-fintech-muted">
                                        Proposer {shortAddr(p.proposer)} · voted:{' '}
                                        {p.voted ? 'yes' : 'no'}
                                    </p>
                                    {meta?.isMember ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <PrimaryButton
                                                type="button"
                                                disabled={busy || p.voted || p.state !== 'Active'}
                                                onClick={() => vote(p.id, true)}
                                            >
                                                Vote For
                                            </PrimaryButton>
                                            <PrimaryButton
                                                type="button"
                                                disabled={busy || p.voted || p.state !== 'Active'}
                                                onClick={() => vote(p.id, false)}
                                            >
                                                Vote Against
                                            </PrimaryButton>
                                            <PrimaryButton
                                                type="button"
                                                disabled={busy || p.state !== 'Succeeded'}
                                                onClick={() => queueOrExecute(p.id, 'queue')}
                                            >
                                                Queue
                                            </PrimaryButton>
                                            <PrimaryButton
                                                type="button"
                                                disabled={busy || p.state !== 'Queued'}
                                                onClick={() => queueOrExecute(p.id, 'execute')}
                                            >
                                                Execute
                                            </PrimaryButton>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </PanelCard>

                <p className="text-xs text-fintech-muted">
                    Signed in as {auth?.user?.email || 'member'}. Admin cannot execute Multisig treasury
                    withdrawals from this page.
                </p>
            </MemberPageShell>
        </AuthenticatedLayout>
    );
}
