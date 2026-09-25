export default function WalletSelectModal({ open, wallets = [], onPick, onClose }) {
    if (!open) {
        return null;
    }

    const detected = wallets.filter((wallet) => wallet.ready && wallet.provider);
    const more = wallets.filter((wallet) => !wallet.ready || !wallet.provider);

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="wallet-select-title"
                className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#07111f] p-4 shadow-2xl"
            >
                <h2 id="wallet-select-title" className="text-base font-bold text-white">
                    Choose your wallet
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                    Use any EVM crypto wallet on BNB Smart Chain. Your wallet, your keys.
                </p>

                {detected.length > 0 ? (
                    <section className="mt-4">
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                            Ready in this browser
                        </h3>
                        <ul className="space-y-2">
                            {detected.map((wallet) => (
                                <WalletRow
                                    key={wallet.id}
                                    wallet={wallet}
                                    action="Connect"
                                    onClick={() => onPick(wallet)}
                                />
                            ))}
                        </ul>
                    </section>
                ) : null}

                <section className={detected.length > 0 ? 'mt-5' : 'mt-4'}>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {detected.length > 0 ? 'More wallets' : 'Popular wallets'}
                    </h3>
                    <ul className="space-y-2">
                        {more.map((wallet) => (
                            <WalletRow
                                key={wallet.id}
                                wallet={wallet}
                                action="Open"
                                onClick={() => onPick(wallet)}
                            />
                        ))}
                    </ul>
                </section>

                <p className="mt-4 text-xs leading-relaxed text-slate-400">
                    Another wallet? Open this site inside that wallet’s in-app browser, then tap
                    Connect again.
                </p>
                <button
                    type="button"
                    className="mt-3 w-full rounded-xl py-2 text-sm text-slate-400 hover:text-white"
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function WalletRow({ wallet, action, onClick }) {
    return (
        <li>
            <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:border-sky-400/70 hover:bg-sky-500/10"
                onClick={onClick}
            >
                {wallet.icon ? (
                    <img src={wallet.icon} alt="" className="h-8 w-8 rounded-lg" />
                ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-100">
                        {String(wallet.name || 'W').slice(0, 1)}
                    </span>
                )}
                <span className="flex-1 text-sm font-semibold text-white">{wallet.name}</span>
                <span className="text-xs font-semibold text-sky-300">{action}</span>
            </button>
        </li>
    );
}
