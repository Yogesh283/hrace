import {
    RACE_FEATURE_AI,
    RACE_FEATURE_GAMING,
    RACE_FEATURE_NETWORK,
    RACE_FEATURE_PAYMENTS,
    RACE_FEATURE_SECURITY,
} from '@/lib/brandAssets';

export const TRUSTED_LOGOS = ['Nexus Labs', 'Orbit Finance', 'Vertex AI', 'ChainForge', 'NovaPay', 'SkyLedger'];

export const CORE_ECOSYSTEM = [
    { title: 'Artificial Intelligence', description: 'Neural automation and predictive intelligence at scale.', icon: 'brain' },
    { title: 'Digital Payments', description: 'Borderless, instant, and secure global transactions.', icon: 'wallet' },
    { title: 'Blockchain', description: 'Decentralized infrastructure with transparent trust.', icon: 'cubes' },
    { title: 'Gaming', description: 'Immersive Web3 gaming with digital ownership.', icon: 'gamepad' },
    { title: 'DAO Governance', description: 'Community-driven decisions with on-chain voting.', icon: 'shield-check' },
    { title: 'Global Network', description: 'Worldwide connectivity through intelligent systems.', icon: 'globe' },
];

export const PRODUCT_SECTIONS = [
    {
        id: 'ai-products',
        label: 'AI Products',
        title: 'Intelligence That',
        highlight: 'Scales With You',
        description: 'Deploy enterprise-grade AI models, automation pipelines, and real-time decision engines built for the next generation of digital business.',
        image: RACE_FEATURE_AI,
        features: ['Neural Automation', 'Predictive Analytics', 'Smart Agents'],
        reverse: false,
    },
    {
        id: 'blockchain',
        label: 'Blockchain Infrastructure',
        title: 'Decentralized',
        highlight: 'By Design',
        description: 'Secure smart contracts, transparent ledgers, and enterprise-grade blockchain architecture powering trust at every layer.',
        image: RACE_FEATURE_SECURITY,
        features: ['Smart Contracts', 'Zero Trust Security', 'On-Chain Transparency'],
        reverse: true,
    },
    {
        id: 'payments',
        label: 'Digital Payments',
        title: 'Payments Without',
        highlight: 'Borders',
        description: 'Lightning-fast settlement, multi-currency support, and institutional-grade security for global digital commerce.',
        image: RACE_FEATURE_PAYMENTS,
        features: ['Instant Transfer', 'Multi Currency', 'Secure Settlement'],
        reverse: false,
    },
    {
        id: 'gaming',
        label: 'Gaming Ecosystem',
        title: 'Play. Earn.',
        highlight: 'Own.',
        description: 'Build immersive blockchain gaming worlds with NFT assets, reward economies, and multiplayer infrastructure.',
        image: RACE_FEATURE_GAMING,
        features: ['NFT Gaming', 'Reward Pools', 'Multiplayer Core'],
        reverse: true,
    },
];

export const STATS = [
    { label: 'Active Users', value: 50, suffix: 'M+', caption: 'Global ecosystem reach' },
    { label: 'AI Automation', value: 100, suffix: '%', caption: 'Intelligent operations' },
    { label: 'Uptime', value: 99, suffix: '.9%', caption: 'Enterprise reliability' },
    { label: 'Countries', value: 120, suffix: '+', caption: 'Worldwide presence' },
];

export const FEATURES_GRID = [
    { title: 'Smart Analytics', description: 'Real-time AI insights and performance monitoring.', icon: 'chart' },
    { title: 'Cloud Infrastructure', description: 'Scalable architecture with maximum uptime.', icon: 'server' },
    { title: 'Enterprise Security', description: 'Advanced encryption and multi-layer protection.', icon: 'shield' },
    { title: 'Lightning Fast', description: 'Ultra-low latency global infrastructure.', icon: 'rocket' },
    { title: 'Community Driven', description: 'Built by stakeholders, for stakeholders.', icon: 'users' },
    { title: 'Innovation First', description: 'Continuous evolution through emerging tech.', icon: 'lightbulb' },
    { title: 'DeFi Utilities', description: 'Powerful decentralized financial services.', icon: 'cubes' },
    { title: 'Global Mesh', description: 'Intelligent network connecting millions.', icon: 'globe' },
];

export const TIMELINE = [
    { year: '2024', title: 'Foundation', body: 'RACE Network core protocol and AI engine launched.' },
    { year: '2025', title: 'Expansion', body: 'Payments, gaming, and DAO governance modules deployed.' },
    { year: '2026', title: 'Global Scale', body: 'Multi-region infrastructure and enterprise partnerships.' },
    { year: '2027', title: 'Next Horizon', body: 'Autonomous AI agents and cross-chain interoperability.' },
];

export const TESTIMONIALS = [
    { quote: 'RACE Network redefined how we think about AI and blockchain convergence. Truly enterprise-grade.', name: 'Sarah Chen', role: 'CTO, Nexus Labs' },
    { quote: 'The most polished Web3 infrastructure we have integrated. Fast, secure, and beautifully designed.', name: 'Marcus Webb', role: 'Head of Product, Orbit Finance' },
    { quote: 'A futuristic platform that delivers real utility. Our community adoption exceeded every expectation.', name: 'Elena Vasquez', role: 'Founder, ChainForge' },
];

export const FAQ_ITEMS = [
    { q: 'What is RACE Network?', a: 'RACE Network is a premium AI and blockchain ecosystem unifying intelligence, payments, gaming, and DAO governance in one platform.' },
    { q: 'Is RACE Network secure?', a: 'Yes. We use enterprise-grade encryption, smart contract audits, and multi-layer security across all infrastructure.' },
    { q: 'Who can use the platform?', a: 'Developers, enterprises, gamers, and community members — anyone building on next-generation digital infrastructure.' },
    { q: 'How does DAO governance work?', a: 'Token holders propose and vote on protocol upgrades, treasury allocation, and ecosystem development transparently on-chain.' },
    { q: 'When can I get started?', a: 'The ecosystem is opening soon. Join the waitlist to be notified when onboarding begins.' },
];

export const HERO_ORBIT = [
    { label: 'AI', icon: 'brain', angle: -90 },
    { label: 'Payments', icon: 'wallet', angle: -18 },
    { label: 'Blockchain', icon: 'cubes', angle: 54 },
    { label: 'Gaming', icon: 'gamepad', angle: 126 },
    { label: 'DAO', icon: 'shield-check', angle: 198 },
];

export const FOOTER_LINKS = [
    { label: 'Ecosystem', href: '#ecosystem' },
    { label: 'AI Products', href: '#ai-products' },
    { label: 'Features', href: '#features' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Get Started', href: '#cta' },
];

export const SOCIAL = [
    { label: 'X', href: '#' },
    { label: 'Discord', href: '#' },
    { label: 'Telegram', href: '#' },
    { label: 'GitHub', href: '#' },
];
