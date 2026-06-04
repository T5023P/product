import Link from "next/link";

const contactEmail = "faisal@topsecurities.online";
const businessPhone = "9415577215";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
      <header className="sticky top-0 z-40 border-b border-[#c6c6cd] bg-[#f7f9fb]/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-10">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-[#131b2e] md:text-2xl"
          >
            TOP SECURITIES
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="#contact"
              className="hidden text-sm font-semibold text-[#57657a] transition-colors hover:text-[#131b2e] sm:inline"
            >
              Contact
            </a>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded bg-[#131b2e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span>Catalog</span>
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden bg-[#131b2e] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-14 md:grid-cols-[1fr_0.86fr] md:px-10 md:py-16">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#ffb690]">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Verified Business Presence</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              TOP SECURITIES
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#dae2fd] md:text-lg">
              Welcome to WebMorphic, the digital and mobile application
              development division of M/S TOP SECURITIES. We specialize in
              building secure, high-performance Android utilities and software
              solutions designed to enhance user productivity and digital
              experiences.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded bg-[#f97316] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                <span>Contact Us</span>
              </a>
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 rounded border border-white/25 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                <span>Open Catalog</span>
              </Link>
            </div>
          </div>

          <div className="relative z-10">
            <div className="border border-white/15 bg-black/25 p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#bec6e0]">
                    WebMorphic Console
                  </p>
                  <p className="text-sm text-white/70">Secure software operations</p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["android", "Android Utilities"],
                  ["security", "Secure Delivery"],
                  ["speed", "Performance"],
                  ["support_agent", "Business Support"],
                ].map(([icon, label]) => (
                  <div key={label} className="border border-white/10 bg-white/5 p-4">
                    <span className="material-symbols-outlined mb-8 block text-[#f97316]">
                      {icon}
                    </span>
                    <p className="text-sm font-semibold text-white">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#bec6e0]">
                    Public Verification Details
                  </span>
                </div>
                <div className="space-y-2 text-sm text-white/80">
                  <p>M/S TOP SECURITIES</p>
                  <p>{contactEmail}</p>
                  <p>{businessPhone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#c6c6cd] bg-white px-4 py-12 md:px-10" id="contact">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-[0.75fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#57657a]">
              Contact
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[#131b2e]">
              Contact Us
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#45464d]">
              Use these official contact details for account verification,
              application support, and business communication.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <a
              href={`mailto:${contactEmail}`}
              className="border border-[#c6c6cd] bg-[#f2f4f6] p-5 transition hover:border-[#131b2e]"
            >
              <span className="material-symbols-outlined mb-5 block text-[#f97316]">
                alternate_email
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#57657a]">
                Email Address
              </p>
              <p className="mt-2 break-words text-base font-semibold text-[#131b2e]">
                {contactEmail}
              </p>
            </a>
            <div className="border border-[#c6c6cd] bg-[#f2f4f6] p-5">
              <span className="material-symbols-outlined mb-5 block text-[#f97316]">
                call
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#57657a]">
                Phone Number
              </p>
              <p className="mt-2 break-words text-base font-semibold text-[#131b2e]">
                {businessPhone}
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#131b2e] px-4 py-8 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-lg font-bold">TOP SECURITIES</p>
          <p className="mt-5 text-sm leading-7 text-[#dae2fd]">
            Legal Entity: M/S TOP SECURITIES (Proprietorship: Faisal Siddiqui)
          </p>
          <p className="text-sm leading-7 text-[#dae2fd]">
            Official Address: SHOP NO 3, NEW AZAD MARKET, CAMPWELL ROAD, AZAD
            NAGAR CHURAHA, Lucknow, Uttar Pradesh, 226027
          </p>
        </div>
      </footer>
    </main>
  );
}
