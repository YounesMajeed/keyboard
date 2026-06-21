import Link from "next/link";

export default function About() {
  const team = [
    {
      name: "Younis Majeed",
      role: "Lead Developer",
      desc: "Architected the custom keyboard layout and engine, handling keyboard states, diacritics logic, and dictionaries.",
      emoji: "💻"
    },
    {
      name: "Amaan Wafiq",
      role: "UI/UX Designer & Dev",
      desc: "Designed the modern premium layout, dark mode colors, glassmorphic interfaces, and micro-animations.",
      emoji: "🎨"
    },
    {
      name: "Mustafa ibn Jameel",
      role: "Language Specialist",
      desc: "Curated and optimized the Shina character mapping, diacritics layout, and normalized Shina vocabulary list.",
      emoji: "✍️"
    },
    {
      name: "Alpha Firdous",
      role: "Contributor & Tester",
      desc: "Ensured layout reliability and verified character compatibility across various devices and screen sizes.",
      emoji: "🧪"
    }
  ];

  return (
    <div className="about-wrapper">
      <header className="about-header">
        <Link href="/" className="btn-back">
          ← Back
        </Link>
        <h1 className="logo">About Us</h1>
        <p className="tagline">Shina Keyboard Team</p>
      </header>

      <div className="about-content">
        <section className="team-section">
          <h2>Our Team</h2>
          <div className="team-grid">
            {team.map((member, idx) => (
              <div key={idx} className="member-card">
                <div className="member-header">
                  <span className="member-emoji">{member.emoji}</span>
                  <div>
                    <h3>{member.name}</h3>
                    <span className="member-role">{member.role}</span>
                  </div>
                </div>
                <p className="member-desc">{member.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="credits-section">
          <h2>Credits & Acknowledgements</h2>
          <div className="credits-card">
            <p>
              Special thanks to everyone who contributed to the preservation and digital layout mapping of the Shina language.
            </p>
            <p className="credits-footnote">
              Version 1.0.0 • Built with Next.js & CSS Variables
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
