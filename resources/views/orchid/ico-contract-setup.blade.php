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
    <h5 class="mb-2">{{ __('Start ICO (Phase 1)') }}</h5>
    <p class="small text-muted">{{ __('Connect the RaceICO owner wallet in MetaMask (deployer, or a wallet that can confirm Multisig). This opens Phase 1 so members can buy. Deposit 6 lakh RACE into ICO Contract first.') }}</p>
    <p class="small mb-2" id="ico-start-status"></p>
    <button type="button" class="btn btn-success" id="ico-start-btn">
        {{ __('Start Phase 1') }}
    </button>
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
    const startStatus = document.getElementById('ico-start-status');
    const startSel = '0x1c9ed381';
    function setStartStatus(msg) {
        if (startStatus) startStatus.textContent = msg;
    }
    if (startBtn) {
        startBtn.addEventListener('click', async function () {
            try {
                if (!window.ethereum) {
                    setStartStatus(@json(__('MetaMask not found.')));
                    return;
                }
                if (!raceIco) {
                    setStartStatus(@json(__('Save RaceICO sale contract first.')));
                    return;
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
                setStartStatus(@json(__('Starting Phase 1…')));
                const tx = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: from,
                        to: raceIco,
                        data: startSel + padUint(1),
                    }],
                });
                setStartStatus(@json(__('Start submitted:')) + ' ' + tx);
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
