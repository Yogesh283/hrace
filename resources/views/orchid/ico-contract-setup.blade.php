<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-2">{{ __('How this is set') }}</h5>
    <ol class="mb-0 small">
        <li>{{ __('Total 10 lakh RACE go to the admin wallet (6 lakh ICO + 4 lakh LP).') }}</li>
        <li>{{ __('Admin deposits 6 lakh into ICO Contract. Keep 4 lakh in the admin wallet for Pancake LP.') }}</li>
        <li>{{ __('Every ICO buy sends USDT to the same admin wallet.') }}</li>
        <li>{{ __('Hold and Create Stake stay on RaceICO. Income mint stays on RewardVault.') }}</li>
        <li>{{ __('There is no ICO admin role in this panel — only this wallet + ICO Contract.') }}</li>
    </ol>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-2">{{ __('On-chain snapshot') }}</h5>
    <p class="mb-1 small"><strong>{{ __('Admin wallet RACE') }}:</strong> {{ $admin_race }}</p>
    <p class="mb-1 small"><strong>{{ __('ICO Contract RACE') }}:</strong> {{ $contract_race }} / {{ $allocation_race }}</p>
    <p class="mb-1 small"><strong>{{ __('RaceICO phase') }}:</strong> {{ $current_phase ?? '—' }}</p>
    <p class="mb-1 small"><strong>{{ __('ICO completed') }}:</strong> {{ $ico_completed ?? '—' }}</p>
    <p class="mb-1 small"><strong>{{ __('On-chain ICO Contract admin') }}:</strong>
        <code class="user-select-all">{{ $on_chain_admin }}</code>
    </p>
    <p class="mb-0 small text-muted">
        {{ $rpc_ok ? __('Read live from RPC.') : __('RPC snapshot unavailable. Save addresses, then refresh.') }}
    </p>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-2">{{ __('Start ICO (Phase 1) — TokenPocket') }}</h5>
    <ol class="small mb-3">
        <li>{{ __('TokenPocket mein BNB Smart Chain kholo. Admin wallet nahi — neeche wale 5 Multisig accounts mein se koi 3.') }}</li>
        <li>{{ __('Pehle account se “1. Submit Phase 1” dabao. Confirm karo. Contract Multisig hona chahiye, RaceICO nahi.') }}</li>
        <li>{{ __('TokenPocket mein dusra account switch karo, “2. Confirm Phase 1” dabao.') }}</li>
        <li>{{ __('Teesra account switch karo, phir “2. Confirm Phase 1” dabao. 3rd confirm par Phase 1 start ho jayega.') }}</li>
    </ol>
    <p class="small mb-2"><strong>{{ __('Multisig contract') }}:</strong> <code class="user-select-all">{{ $multisig_contract }}</code></p>
    <p class="small mb-2"><strong>{{ __('Use these 5 wallets only') }}:</strong></p>
    <ul class="small mb-3">
        @foreach ($multisig_signers ?? [] as $signer)
            <li><code class="user-select-all">{{ $signer }}</code></li>
        @endforeach
    </ul>
    <p class="small mb-2" id="ico-start-status"></p>
    <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-success" id="ico-start-btn">
            {{ __('1. Submit Phase 1') }}
        </button>
        <button type="button" class="btn btn-outline-success" id="ico-confirm-btn">
            {{ __('2. Confirm Phase 1') }}
        </button>
    </div>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-2">{{ __('Deposit 600,000 RACE into ICO Contract') }}</h5>
    <p class="small text-muted">{{ __('Connect the admin wallet in MetaMask on the same chain, then approve + deposit. ICO Contract must already list this wallet as admin.') }}</p>
    <p class="small mb-2" id="ico-deposit-status"></p>
    <button type="button" class="btn btn-primary" id="ico-deposit-btn">
        {{ __('Approve & deposit 600,000 RACE') }}
    </button>
</div>

<div class="bg-white rounded shadow-sm p-4 mb-3">
    <h5 class="mb-2">{{ __('Withdraw RACE from ICO Contract') }}</h5>
    <p class="small text-muted">{{ __('Admin can withdraw unsold RACE sitting in ICO Contract back to the admin wallet. Sold / held coins on RaceICO stay with buyers.') }}</p>
    <p class="small mb-2" id="ico-withdraw-status"></p>
    <button type="button" class="btn btn-outline-primary" id="ico-withdraw-btn">
        {{ __('Withdraw available RACE') }}
    </button>
</div>

<script>
(function () {
    const btn = document.getElementById('ico-deposit-btn');
    const status = document.getElementById('ico-deposit-status');
    if (!btn) return;

    const icoContract = @json($ico_contract);
    const raceIco = @json($race_ico_contract);
    const raceToken = @json($race_token);
    const adminWallet = @json($ico_admin_wallet);
    const chainId = Number(@json($chain_id));
    const amountWei = @json($deposit_amount_wei);
    const approveSel = '0x095ea7b3';
    const depositSel = '0xf42d48a1';

    function padAddr(addr) {
        return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    }
    function padUint(dec) {
        return BigInt(dec).toString(16).padStart(64, '0');
    }
    function setStatus(msg) {
        status.textContent = msg;
    }
    function toHexChain(id) {
        return '0x' + Number(id).toString(16);
    }

    btn.addEventListener('click', async function () {
        try {
            if (!window.ethereum) {
                setStatus(@json(__('MetaMask not found. Open this page in a browser with the admin wallet.')));
                return;
            }
            if (!icoContract || !raceToken || !adminWallet) {
                setStatus(@json(__('Save ICO Contract, Race token, and admin wallet first.')));
                return;
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const from = (accounts[0] || '').toLowerCase();
            if (from !== adminWallet.toLowerCase()) {
                setStatus(@json(__('Connected wallet is not the ICO admin wallet. Switch to the admin address.')));
                return;
            }
            const liveChain = await window.ethereum.request({ method: 'eth_chainId' });
            if (Number(liveChain) !== chainId) {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: toHexChain(chainId) }],
                });
            }
            setStatus(@json(__('Approve RACE…')));
            await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: from,
                    to: raceToken,
                    data: approveSel + padAddr(icoContract) + padUint(amountWei),
                }],
            });
            setStatus(@json(__('Deposit into ICO Contract…')));
            const tx = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: from,
                    to: icoContract,
                    data: depositSel + padUint(amountWei),
                }],
            });
            setStatus(@json(__('Deposit submitted:')) + ' ' + tx);
        } catch (err) {
            setStatus(err && err.message ? err.message : String(err));
        }
    });

    const withdrawBtn = document.getElementById('ico-withdraw-btn');
    const withdrawStatus = document.getElementById('ico-withdraw-status');
    const availableSel = '0x48a0d754';
    const withdrawSel = '0x3e696f38';

    function setWithdrawStatus(msg) {
        if (withdrawStatus) withdrawStatus.textContent = msg;
    }

    const startBtn = document.getElementById('ico-start-btn');
    const confirmBtn = document.getElementById('ico-confirm-btn');
    const startStatus = document.getElementById('ico-start-status');
    const startSel = '0x1c9ed381';
    const startPhaseData = startSel + padUint(1);
    const submitSel = 'c6427474';
    const confirmSel = 'c01a8c84';
    const txCountSel = '0xb77bf600';
    const isSignerSel = '0x7df73e27';
    const getTxSel = '0x33ea3dc8';
    const isConfirmedSel = '0x80f59a65';
    const multiSig = @json($multisig_contract ?? '');
    const signers = (@json($multisig_signers ?? [])).map((s) => String(s).toLowerCase());

    function setStartStatus(msg) {
        if (startStatus) startStatus.textContent = msg;
    }

    function encodeSubmit(to, innerData) {
        const raw = String(innerData || '').replace(/^0x/, '');
        const padBytes = (32 - ((raw.length / 2) % 32)) % 32;
        return '0x' + submitSel + padAddr(to) + padUint(0) + padUint(96) + padUint(raw.length / 2) + raw + '00'.repeat(padBytes);
    }

    async function ethCall(to, data) {
        return window.ethereum.request({
            method: 'eth_call',
            params: [{ to: to, data: data }, 'latest'],
        });
    }

    async function waitReceipt(hash) {
        for (let i = 0; i < 40; i++) {
            const receipt = await window.ethereum.request({
                method: 'eth_getTransactionReceipt',
                params: [hash],
            });
            if (receipt && receipt.blockNumber) {
                if (receipt.status === '0x0') {
                    throw new Error('Transaction reverted: ' + hash);
                }
                return receipt;
            }
            await new Promise((r) => setTimeout(r, 3000));
        }
        throw new Error('Transaction not mined yet. Wait and tap Confirm. Hash: ' + hash);
    }

    async function findPendingStartPhase() {
        const count = BigInt(await ethCall(multiSig, txCountSel) || '0x0');
        let best = null;
        for (let i = 0; i < count; i++) {
            const raw = await ethCall(multiSig, getTxSel + padUint(i));
            if (!raw || raw === '0x') continue;
            const hex = raw.replace(/^0x/, '').padStart(320, '0');
            const to = ('0x' + hex.slice(24, 64)).toLowerCase();
            const executed = BigInt('0x' + hex.slice(192, 256)) === 1n;
            const confirmations = Number(BigInt('0x' + hex.slice(256, 320)));
            const dataOffset = Number(BigInt('0x' + hex.slice(128, 192))) * 2;
            const dataLen = Number(BigInt('0x' + hex.slice(dataOffset, dataOffset + 64))) * 2;
            const data = '0x' + hex.slice(dataOffset + 64, dataOffset + 64 + dataLen);
            if (executed) continue;
            if (to !== String(raceIco).toLowerCase()) continue;
            if (data.toLowerCase() !== startPhaseData.toLowerCase()) continue;
            if (!best || confirmations > best.confirmations) {
                best = { id: String(i), confirmations: confirmations };
            }
        }
        return best;
    }

    async function connectSigner() {
        if (!window.ethereum) {
            throw new Error(@json(__('TokenPocket / MetaMask not found. Open this page inside TokenPocket DApp browser.')));
        }
        if (!raceIco || !multiSig) {
            throw new Error(@json(__('Save RaceICO and Multisig addresses first.')));
        }
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const from = (accounts[0] || '').toLowerCase();
        const liveChain = await window.ethereum.request({ method: 'eth_chainId' });
        if (Number(liveChain) !== chainId) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: toHexChain(chainId) }],
            });
        }
        if (!signers.includes(from)) {
            throw new Error(@json(__('Wrong wallet. In TokenPocket switch to one of the 5 Multisig signer accounts. Not the admin USDT wallet.')));
        }
        const signerHex = await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: multiSig, data: isSignerSel + padAddr(from) }, 'latest'],
        });
        if (BigInt(signerHex || '0x0') !== 1n) {
            throw new Error(@json(__('This account is not a Multisig signer on-chain.')));
        }
        return from;
    }

    if (startBtn) {
        startBtn.addEventListener('click', async function () {
            try {
                const from = await connectSigner();
                const pending = await findPendingStartPhase();
                if (pending) {
                    window.localStorage.setItem('race.multisig.phase1.txId', pending.id);
                    setStartStatus(
                        @json(__('Phase 1 is already submitted. Do NOT submit again. Switch to another signer and tap Confirm Phase 1. Multisig id:')) +
                            ' ' + pending.id + ' · confirms ' + pending.confirmations + '/3',
                    );
                    return;
                }
                setStartStatus(@json(__('Submitting Phase 1 to Multisig… Confirm in TokenPocket. To address must be the Multisig.')));
                const hash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: from,
                        to: multiSig,
                        data: encodeSubmit(raceIco, startPhaseData),
                    }],
                });
                setStartStatus(@json(__('Waiting for submit to mine…')) + ' ' + hash);
                await waitReceipt(hash);
                const created = await findPendingStartPhase();
                const txId = created ? created.id : '0';
                window.localStorage.setItem('race.multisig.phase1.txId', txId);
                setStartStatus(@json(__('Submit OK. Switch TokenPocket to a SECOND signer and tap Confirm Phase 1. id:')) + ' ' + txId);
            } catch (err) {
                setStartStatus(err && err.message ? err.message : String(err));
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async function () {
            try {
                const from = await connectSigner();
                const pending = await findPendingStartPhase();
                if (!pending) {
                    throw new Error(@json(__('No pending Phase 1 Multisig tx. Tap Submit Phase 1 first from one signer.')));
                }
                const alreadyHex = await ethCall(
                    multiSig,
                    isConfirmedSel + padUint(pending.id) + padAddr(from),
                );
                if (BigInt(alreadyHex || '0x0') === 1n) {
                    setStartStatus(
                        @json(__('This wallet already confirmed. Switch TokenPocket to another signer and tap Confirm again. id:')) +
                            ' ' + pending.id + ' · ' + pending.confirmations + '/3',
                    );
                    return;
                }
                window.localStorage.setItem('race.multisig.phase1.txId', pending.id);
                setStartStatus(@json(__('Confirming the SAME Phase 1 Multisig tx…')) + ' id ' + pending.id + ' · ' + pending.confirmations + '/3');
                const hash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: from,
                        to: multiSig,
                        data: '0x' + confirmSel + padUint(pending.id),
                    }],
                });
                setStartStatus(@json(__('Waiting for confirm to mine…')) + ' ' + hash);
                await waitReceipt(hash);
                const after = await findPendingStartPhase();
                if (!after) {
                    setStartStatus(@json(__('Phase 1 should now be started. Refresh this page and check RaceICO phase = 1.')));
                    return;
                }
                setStartStatus(
                    @json(__('Confirm saved. Switch to the NEXT signer and tap Confirm again. Still need 3 wallets on the SAME id:')) +
                        ' ' + after.id + ' · ' + after.confirmations + '/3',
                );
            } catch (err) {
                setStartStatus(err && err.message ? err.message : String(err));
            }
        });
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', async function () {
            try {
                if (!window.ethereum) {
                    setWithdrawStatus(@json(__('MetaMask not found. Open this page in a browser with the admin wallet.')));
                    return;
                }
                if (!icoContract || !adminWallet) {
                    setWithdrawStatus(@json(__('Save ICO Contract and admin wallet first.')));
                    return;
                }
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const from = (accounts[0] || '').toLowerCase();
                if (from !== adminWallet.toLowerCase()) {
                    setWithdrawStatus(@json(__('Connected wallet is not the ICO admin wallet. Switch to the admin address.')));
                    return;
                }
                const liveChain = await window.ethereum.request({ method: 'eth_chainId' });
                if (Number(liveChain) !== chainId) {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: toHexChain(chainId) }],
                    });
                }
                const availableHex = await window.ethereum.request({
                    method: 'eth_call',
                    params: [{ to: icoContract, data: availableSel }, 'latest'],
                });
                const available = BigInt(availableHex || '0x0');
                if (available <= 0n) {
                    setWithdrawStatus(@json(__('ICO Contract has no unsold RACE to withdraw.')));
                    return;
                }
                setWithdrawStatus(@json(__('Withdraw from ICO Contract…')));
                const tx = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: from,
                        to: icoContract,
                        data: withdrawSel + padUint(available.toString()),
                    }],
                });
                setWithdrawStatus(@json(__('Withdraw submitted:')) + ' ' + tx);
            } catch (err) {
                setWithdrawStatus(err && err.message ? err.message : String(err));
            }
        });
    }
})();
</script>
