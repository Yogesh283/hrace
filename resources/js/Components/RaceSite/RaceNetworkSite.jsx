import {
    RaceBackground,
    RaceBtn,
    RaceContentWithImage,
    RaceFooter,
    RaceGlassCard,
    RaceIcon3D,
    RaceNavbar,
    RaceSectionHead,
    COLORS,
    fadeUp,
} from '@/Components/RaceSite/RaceSiteUI';
import {
    ABOUT,
    CONTACT,
    DEVELOPERS,
    DOCUMENTS,
    ECOSYSTEM,
    FAQ,
    FOOTER,
    GOVERNANCE,
    HERO,
    MISSION,
    PARTNERS,
    REWARDS,
    ROADMAP,
    SECURITY,
    STAKING,
    TOKEN,
    TRANSPARENCY,
    VISION,
    WHY,
} from '@/data/raceSiteContent';
import { RACE_LOGO_SRC, RACE_NETWORK_HERO_BANNER, RACE_SECTION_BANNERS } from '@/lib/brandAssets';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

function SectionWrap({ id, children, className = '' }) {
    return (
        <section id={id} className={`scroll-mt-20 px-3 py-10 sm:scroll-mt-24 sm:px-6 sm:py-20 ${className}`}>
            <div className="mx-auto w-full max-w-7xl">{children}</div>
        </section>
    );
}

function BulletGrid({ items, cols = 'sm:grid-cols-2 lg:grid-cols-3' }) {
    return (
        <div className={`grid gap-4 ${cols}`}>
            {items.map((item, i) => {
                const title = typeof item === 'string' ? item : item.title;
                const desc = typeof item === 'string' ? null : item.desc;
                const icon = typeof item === 'string' ? null : item.icon;
                return (
                    <motion.div key={title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <RaceGlassCard className="h-full p-4 sm:p-6">
                            {icon ? <RaceIcon3D name={icon} className="mb-3 h-10 w-10 sm:mb-4 sm:h-11 sm:w-11" /> : null}
                            <h3 className="font-space text-[0.95rem] font-bold text-white sm:text-lg">{title}</h3>
                            <div className="rx-site-gold-line my-3 max-w-[40px]" />
                            {desc ? <p className="text-sm leading-relaxed text-[#9CA3AF]">{desc}</p> : null}
                        </RaceGlassCard>
                    </motion.div>
                );
            })}
        </div>
    );
}

const PDF_UNLOCK_KEY = 'race_pdf_unlocked';

function readUnlockedPdfs() {
    try {
        const raw = window.localStorage.getItem(PDF_UNLOCK_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function PdfDownloadCards({ pdfs }) {
    const [unlocked, setUnlocked] = useState({});

    useEffect(() => {
        setUnlocked(readUnlockedPdfs());
    }, []);

    const markUnlocked = (id) => {
        setUnlocked((prev) => {
            const next = { ...prev, [id]: true };
            try {
                window.localStorage.setItem(PDF_UNLOCK_KEY, JSON.stringify(next));
            } catch {
                // ignore storage errors
            }
            return next;
        });
    };

    const handleDownload = (pdf) => {
        const link = document.createElement('a');
        link.href = pdf.href;
        link.download = pdf.fileName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        markUnlocked(pdf.id);
        // After download, open view in a new tab
        window.setTimeout(() => {
            window.open(pdf.href, '_blank', 'noopener,noreferrer');
        }, 400);
    };

    return (
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
            {pdfs.map((pdf, i) => {
                const canView = Boolean(unlocked[pdf.id]);
                return (
                    <motion.div key={pdf.id} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <RaceGlassCard className="flex h-full flex-col p-5 sm:p-6">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            </div>
                            <h3 className="font-space text-base font-bold text-white sm:text-lg">{pdf.title}</h3>
                            <div className="rx-site-gold-line my-3 max-w-[40px]" />
                            <p className="mb-6 flex-1 text-sm leading-relaxed text-[#9CA3AF]">{pdf.desc}</p>
                            <div className="flex flex-col gap-2.5 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => handleDownload(pdf)}
                                    className="rx-site-btn group w-full justify-center !px-4 !py-3 !text-xs sm:!text-sm"
                                >
                                    <span className="rx-site-btn__shine" aria-hidden />
                                    Download
                                    <span className="ml-2 inline-block transition group-hover:translate-x-1">↓</span>
                                </button>
                                {canView ? (
                                    <a
                                        href={pdf.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rx-site-btn-ghost group w-full justify-center !px-4 !py-3 !text-xs sm:!text-sm"
                                    >
                                        View
                                        <span className="ml-2 inline-block transition group-hover:translate-x-1">→</span>
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className="rx-site-btn-ghost w-full cursor-not-allowed justify-center !px-4 !py-3 !text-xs opacity-45 sm:!text-sm"
                                        title="Download first to unlock View"
                                    >
                                        View (after download)
                                    </button>
                                )}
                            </div>
                        </RaceGlassCard>
                    </motion.div>
                );
            })}
        </div>
    );
}

export default function RaceNetworkSite() {
    const reduce = useReducedMotion();
    const [faqOpen, setFaqOpen] = useState(0);
    const banners = RACE_SECTION_BANNERS;

    return (
        <>
            <div
                className="rx-site relative min-h-screen w-full max-w-[100vw] overflow-x-clip font-inter text-white antialiased"
                style={{ background: COLORS.bg }}
            >
                <RaceBackground reduce={reduce} />
                <RaceNavbar />

                <main className="relative z-10 pt-[64px] sm:pt-[72px]">
                    {/* PAGE 1 — HERO + BANNER */}
                    <section id="hero" className="relative scroll-mt-20 overflow-hidden sm:scroll-mt-24">
                        <div className="absolute inset-0">
                            <img
                                src={banners.hero || RACE_NETWORK_HERO_BANNER}
                                alt=""
                                className="h-full w-full object-cover object-[center_30%] sm:object-center"
                            />
                            <div className="absolute inset-0 bg-[#0B0F19]/75 sm:bg-[#0B0F19]/72" />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] via-[#0B0F19]/85 to-[#0B0F19]/45 sm:via-[#0B0F19]/78 sm:to-[#0B0F19]/35" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-[#0B0F19]/45" />
                        </div>

                        <div className="relative z-10 mx-auto flex min-h-[auto] max-w-7xl items-center px-3 pb-12 pt-10 sm:min-h-[88vh] sm:px-6 sm:pb-24 sm:pt-14 lg:py-20">
                            <div className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                                <motion.div initial="hidden" animate="visible" variants={fadeUp} className="min-w-0">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <img
                                            src={RACE_LOGO_SRC}
                                            alt="RACE Network"
                                            className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.45)] sm:h-16 sm:w-16"
                                        />
                                        <div className="min-w-0">
                                            <p className="font-space text-2xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                                                {HERO.brand}
                                            </p>
                                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37] sm:text-xs sm:tracking-[0.28em]">
                                                {HERO.powered}
                                            </p>
                                        </div>
                                    </div>
                                    <h1 className="font-space mt-6 max-w-2xl text-[1.65rem] font-bold leading-[1.15] tracking-tight text-white sm:mt-8 sm:text-4xl lg:text-[2.75rem]">
                                        {HERO.title}{' '}
                                        <span className="rx-site-text-gold">{HERO.highlight}</span>
                                    </h1>
                                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#9CA3AF] sm:mt-6 sm:text-base lg:text-lg">
                                        {HERO.subtitle}
                                    </p>
                                    {HERO.mission ? (
                                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9CA3AF] sm:mt-4 lg:text-base">
                                            {HERO.mission}
                                        </p>
                                    ) : null}
                                    <p className="mt-4 max-w-xl text-sm font-medium text-white/90 sm:mt-5">{HERO.line}</p>
                                    <div className="mt-8 flex w-full flex-col gap-2.5 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-3">
                                        <RaceBtn href="#ecosystem">{HERO.ctaPrimary}</RaceBtn>
                                        <RaceBtn href="#documents" variant="ghost">
                                            {HERO.ctaSecondary}
                                        </RaceBtn>
                                        <RaceBtn href="#contact" variant="ghost">
                                            {HERO.ctaTertiary}
                                        </RaceBtn>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                    className="w-full min-w-0 lg:block"
                                >
                                    <div className="overflow-hidden rounded-xl border border-[#D4AF37]/35 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.9),0_0_40px_-10px_rgba(212,175,55,0.35)] sm:rounded-[1.35rem]">
                                        <img
                                            src={banners.hero || RACE_NETWORK_HERO_BANNER}
                                            alt="RACE Network banner"
                                            className="aspect-[16/9] w-full object-cover sm:aspect-[16/10]"
                                        />
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </section>

                    {/* PAGE 2 — ABOUT */}
                    <SectionWrap id="about">
                        <RaceContentWithImage src={banners.about} alt="About RACE Network">
                            <RaceSectionHead label={ABOUT.label} title={ABOUT.title} highlight={ABOUT.highlight} center={false} />
                            <div className="space-y-4">
                                {ABOUT.body.map((p) => (
                                    <p key={p.slice(0, 28)} className="text-sm leading-relaxed text-[#9CA3AF] sm:text-base">
                                        {p}
                                    </p>
                                ))}
                            </div>
                        </RaceContentWithImage>
                    </SectionWrap>

                    {/* PAGE 3 — VISION & MISSION */}
                    <SectionWrap id="vision" className="!pt-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <RaceGlassCard className="overflow-hidden p-0">
                                <img src={banners.vision} alt="" className="h-28 w-full object-cover sm:h-36" />
                                <div className="p-5 sm:p-8">
                                    <RaceSectionHead label={VISION.label} title={VISION.title} highlight={VISION.highlight} center={false} />
                                    <p className="text-sm leading-relaxed text-[#9CA3AF] sm:text-base">{VISION.body}</p>
                                </div>
                            </RaceGlassCard>
                            <RaceGlassCard className="overflow-hidden p-0" id="mission">
                                <img src={banners.mission} alt="" className="h-28 w-full object-cover sm:h-36" />
                                <div className="p-5 sm:p-8">
                                    <RaceSectionHead label={MISSION.label} title={MISSION.title} highlight={MISSION.highlight} center={false} />
                                    <p className="text-sm leading-relaxed text-[#9CA3AF] sm:text-base">{MISSION.body}</p>
                                </div>
                            </RaceGlassCard>
                        </div>
                    </SectionWrap>

                    {/* PAGE 4 — WHY */}
                    <SectionWrap id="why">
                        <RaceSectionHead
                            label={WHY.label}
                            title={WHY.title}
                            highlight={WHY.highlight}
                            subtitle={WHY.subtitle}
                        />
                        <BulletGrid items={WHY.items} cols="sm:grid-cols-2 lg:grid-cols-4" />
                    </SectionWrap>

                    {/* PAGE 5 — ECOSYSTEM */}
                    <SectionWrap id="ecosystem">
                        <RaceContentWithImage src={banners.ecosystem} alt="Ecosystem" reverse>
                            <RaceSectionHead
                                label={ECOSYSTEM.label}
                                title={ECOSYSTEM.title}
                                highlight={ECOSYSTEM.highlight}
                                subtitle={ECOSYSTEM.subtitle}
                                center={false}
                            />
                            <p className="text-sm text-[#9CA3AF]">{ECOSYSTEM.footer}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={ECOSYSTEM.items} />
                        </div>
                    </SectionWrap>

                    {/* PAGE 6 — RACE COIN */}
                    <SectionWrap id="token">
                        <RaceContentWithImage src={banners.token} alt="RACE Coin">
                            <RaceSectionHead label={TOKEN.label} title={TOKEN.title} highlight={TOKEN.highlight} subtitle={TOKEN.body} center={false} />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{TOKEN.more}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={TOKEN.utilities} />
                        </div>
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">{TOKEN.closing}</p>
                    </SectionWrap>

                    {/* PAGE 7 — STAKING */}
                    <SectionWrap id="staking">
                        <RaceContentWithImage src={banners.staking} alt="Staking" reverse>
                            <RaceSectionHead label={STAKING.label} title={STAKING.title} highlight={STAKING.highlight} subtitle={STAKING.body} center={false} />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{STAKING.more}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={STAKING.items} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        </div>
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">{STAKING.closing}</p>
                    </SectionWrap>

                    {/* PAGE 8 — COMMUNITY REWARDS */}
                    <SectionWrap id="rewards">
                        <RaceSectionHead label={REWARDS.label} title={REWARDS.title} highlight={REWARDS.highlight} subtitle={REWARDS.body} />
                        <BulletGrid items={REWARDS.items} />
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">{REWARDS.closing}</p>
                    </SectionWrap>

                    {/* PAGE 9 — GOVERNANCE */}
                    <SectionWrap id="governance" className="rx-site-map-section">
                        <RaceContentWithImage src={banners.governance} alt="Governance">
                            <RaceSectionHead
                                label={GOVERNANCE.label}
                                title={GOVERNANCE.title}
                                highlight={GOVERNANCE.highlight}
                                subtitle={GOVERNANCE.body}
                                center={false}
                            />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{GOVERNANCE.closing}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={GOVERNANCE.items} />
                        </div>
                    </SectionWrap>

                    {/* PAGE 10 — ROADMAP */}
                    <SectionWrap id="roadmap">
                        <RaceSectionHead
                            label="Roadmap"
                            title="Building the Future,"
                            highlight="Step by Step"
                            subtitle="The RACE Network roadmap outlines the strategic milestones that guide the continuous development of the ecosystem."
                        />
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            {ROADMAP.map((r, i) => (
                                <motion.div key={r.phase} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                    <RaceGlassCard className="h-full p-5">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">{r.phase}</p>
                                        <h3 className="font-space mt-3 text-base font-bold text-white">{r.title}</h3>
                                    </RaceGlassCard>
                                </motion.div>
                            ))}
                        </div>
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">
                            Every milestone is designed to strengthen the ecosystem, expand real-world utility, and support the long-term vision of RACE Network.
                        </p>
                    </SectionWrap>

                    {/* PAGE 11 — DOCUMENTS */}
                    <SectionWrap id="documents">
                        <RaceSectionHead
                            label={DOCUMENTS.label}
                            title={DOCUMENTS.title}
                            highlight={DOCUMENTS.highlight}
                            subtitle={DOCUMENTS.subtitle}
                        />
                        <PdfDownloadCards pdfs={DOCUMENTS.pdfs || []} />
                        <div className="mt-8 sm:mt-10">
                            <BulletGrid items={DOCUMENTS.items} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        </div>
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">{DOCUMENTS.closing}</p>
                    </SectionWrap>

                    {/* PAGE 12 — PARTNERS */}
                    <SectionWrap id="partners">
                        <RaceContentWithImage src={banners.partners} alt="Partners" reverse>
                            <RaceSectionHead
                                label={PARTNERS.label}
                                title={PARTNERS.title}
                                highlight={PARTNERS.highlight}
                                subtitle={PARTNERS.subtitle}
                                center={false}
                            />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{PARTNERS.closing}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={PARTNERS.items} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        </div>
                    </SectionWrap>

                    {/* PAGE 13 — FAQ */}
                    <SectionWrap id="faq">
                        <div className="mx-auto max-w-3xl">
                            <RaceSectionHead label="FAQ" title="Frequently Asked" highlight="Questions" />
                            <div className="space-y-3">
                                {FAQ.map((item, i) => (
                                    <RaceGlassCard key={item.q} hover={false} className="overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                                            className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
                                        >
                                            <span className="font-space min-w-0 flex-1 break-words text-sm font-semibold text-white sm:text-base">{item.q}</span>
                                            <span className={`text-lg text-[#D4AF37] transition ${faqOpen === i ? 'rotate-45' : ''}`}>+</span>
                                        </button>
                                        {faqOpen === i ? (
                                            <>
                                                <div className="rx-site-gold-line mx-6" />
                                                <p className="px-5 pb-5 pt-3 text-sm leading-relaxed text-[#9CA3AF] sm:px-6 sm:pb-6">
                                                    {item.a}
                                                </p>
                                            </>
                                        ) : null}
                                    </RaceGlassCard>
                                ))}
                            </div>
                        </div>
                    </SectionWrap>

                    {/* PAGE 14 — SECURITY */}
                    <SectionWrap id="security">
                        <RaceContentWithImage src={banners.security} alt="Security">
                            <RaceSectionHead
                                label={SECURITY.label}
                                title={SECURITY.title}
                                highlight={SECURITY.highlight}
                                subtitle={SECURITY.subtitle}
                                center={false}
                            />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{SECURITY.closing}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={SECURITY.items} />
                        </div>
                    </SectionWrap>

                    {/* PAGE 15 — DEVELOPERS */}
                    <SectionWrap id="developers">
                        <RaceSectionHead
                            label={DEVELOPERS.label}
                            title={DEVELOPERS.title}
                            highlight={DEVELOPERS.highlight}
                            subtitle={DEVELOPERS.subtitle}
                        />
                        <BulletGrid items={DEVELOPERS.items} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[#9CA3AF]">{DEVELOPERS.closing}</p>
                    </SectionWrap>

                    {/* PAGE 16 — TRANSPARENCY */}
                    <SectionWrap id="transparency">
                        <RaceContentWithImage src={banners.transparency} alt="Transparency" reverse>
                            <RaceSectionHead
                                label={TRANSPARENCY.label}
                                title={TRANSPARENCY.title}
                                highlight={TRANSPARENCY.highlight}
                                subtitle={TRANSPARENCY.subtitle}
                                center={false}
                            />
                            <p className="mt-4 text-sm text-[#9CA3AF]">{TRANSPARENCY.closing}</p>
                        </RaceContentWithImage>
                        <div className="mt-10">
                            <BulletGrid items={TRANSPARENCY.items} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        </div>
                    </SectionWrap>

                    {/* PAGE 17 — CONTACT */}
                    <SectionWrap id="contact">
                        <RaceSectionHead
                            label={CONTACT.label}
                            title={CONTACT.title}
                            highlight={CONTACT.highlight}
                            subtitle={CONTACT.subtitle}
                        />
                        <BulletGrid items={CONTACT.categories} cols="sm:grid-cols-2 lg:grid-cols-3" />
                        <div className="mx-auto mt-8 max-w-xl sm:mt-10">
                            <RaceGlassCard hover={false} className="overflow-hidden p-0">
                                <img src={banners.contact} alt="" className="h-24 w-full object-cover sm:h-28" />
                                <div className="space-y-3 p-4 sm:space-y-4 sm:p-8">
                                    <input type="text" placeholder="Your Name" className="rx-site-input w-full" />
                                    <input type="email" placeholder="Email Address" className="rx-site-input w-full" />
                                    <textarea rows={4} placeholder="Message" className="rx-site-input w-full resize-none" />
                                    <RaceBtn onClick={() => setAuthOpen(true)} className="w-full justify-center">
                                        Send Message
                                    </RaceBtn>
                                    <p className="text-center text-sm text-[#9CA3AF]">{CONTACT.closing}</p>
                                </div>
                            </RaceGlassCard>
                        </div>
                    </SectionWrap>
                </main>

                {/* PAGE 18 — FOOTER with banner strip */}
                <div className="relative px-3 pb-2 sm:px-6">
                    <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-[#D4AF37]/20 sm:rounded-2xl">
                        <img
                            src={banners.footer || banners.hero}
                            alt=""
                            className="h-20 w-full object-cover object-center opacity-80 sm:h-32"
                        />
                    </div>
                </div>
                <RaceFooter footer={FOOTER} />
            </div>
        </>
    );
}
