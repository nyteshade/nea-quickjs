import { useEffect, useMemo, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Progress from '@radix-ui/react-progress';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Blocks,
  Braces,
  Cpu,
  Library,
  Monitor,
  Network,
  PackageCheck,
  Play,
  Terminal,
  X,
} from 'lucide-react';
import { docsPages, examples, modules, navPages, pillars, project, stats, timeline } from './content.js';

const iconMap = [Library, Cpu, Network, Monitor];

function HeroVisual() {
  return (
    <div className="hero-visual" aria-label="Workbench-style QuickJS session preview">
      <div className="window-bar">
        <span />
        <strong>Workbench: qjs</strong>
      </div>
      <div className="screen-grid">
        <div className="terminal-pane">
          <p>1&gt; version LIBS:quickjs.library</p>
          <p>quickjs.060fpu.library {project.version} ({project.versionDate})</p>
          <p>1&gt; qjs examples/reaction_clock_demo.js</p>
          <p className="ok">Reaction window opened. Timer signal merged.</p>
        </div>
        <div className="mini-window">
          <div className="mini-title">JavaScript</div>
          <div className="mini-body">
            <div className="gauge"><span /></div>
            <button>Run script</button>
            <button>Open GUI</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ item }) {
  return (
    <div className="stat-card">
      <div>{item.label}</div>
      <strong>{item.value}</strong>
      <p>{item.detail}</p>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="code-block">
      <code>{children}</code>
    </pre>
  );
}

function useRoute() {
  const initial = () => {
    const key = window.location.hash.replace(/^#\/?/, '') || 'home';
    return key in docsPages || key === 'home' ? key : 'home';
  };
  const [route, setRoute] = useState(initial);

  useEffect(() => {
    const onHash = () => setRoute(initial());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (key) => {
    window.location.hash = key === 'home' ? '#home' : `#${key}`;
    setRoute(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return [route, navigate];
}

function SiteNav({ route, navigate }) {
  return (
    <nav className="nav" aria-label="Primary">
      <button className="brand nav-button" onClick={() => navigate('home')} aria-current={route === 'home' ? 'page' : undefined}>
        <Braces size={24} aria-hidden="true" />
        <span>{project.name}</span>
      </button>
      <div>
        {navPages.map(([key, label]) => (
          <button
            key={key}
            className="nav-link"
            onClick={() => navigate(key)}
            aria-current={route === key ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function DocsPage({ pageKey, navigate }) {
  const page = docsPages[pageKey];
  const aside = useMemo(() => navPages.filter(([key]) => key !== pageKey), [pageKey]);

  return (
    <main className="docs-shell">
      <SiteNav route={pageKey} navigate={navigate} />
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <strong>Documentation</strong>
          {navPages.map(([key, label]) => (
            <button key={key} onClick={() => navigate(key)} aria-current={pageKey === key ? 'page' : undefined}>
              {label}
            </button>
          ))}
          <a href="../ibrowse/index.html">IBrowse edition</a>
        </aside>
        <article className="docs-article">
          <div className="section-head">
            <span>{page.kicker}</span>
            <h1>{page.title}</h1>
          </div>
          <p className="docs-intro">{page.intro}</p>
          {page.sections.map((section) => (
            <section className="doc-section" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.code && <CodeBlock>{section.code}</CodeBlock>}
            </section>
          ))}
          <div className="next-grid">
            {aside.slice(0, 3).map(([key, label]) => (
              <button key={key} onClick={() => navigate(key)}>
                <span>Read next</span>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

function App() {
  const [route, navigate] = useRoute();

  if (route !== 'home') {
    return (
      <Tooltip.Provider delayDuration={120}>
        <DocsPage pageKey={route} navigate={navigate} />
      </Tooltip.Provider>
    );
  }

  return (
    <Tooltip.Provider delayDuration={120}>
      <main>
        <section className="hero">
          <SiteNav route={route} navigate={navigate} />

          <div className="hero-content">
            <div>
              <div className="eyebrow">
                <PackageCheck size={16} aria-hidden="true" />
                quickjs.library {project.version}
              </div>
              <h1>{project.name}</h1>
              <p className="lead">{project.tagline}</p>
              <p>
                A shared library, CLI, Node-style compatibility layer, web API subset,
                and Amiga GUI bridge for 68020+ machines.
              </p>
              <div className="hero-actions">
                <Dialog.Root>
                  <Dialog.Trigger asChild>
                    <button className="primary">
                      <Play size={18} aria-hidden="true" />
                      Launch brief
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog">
                      <Dialog.Title>Project brief</Dialog.Title>
                      <Dialog.Description>
                        nea-quickjs turns QuickJS-ng into an AmigaOS-native platform.
                        The central artifact is quickjs.library; qjs is a client.
                      </Dialog.Description>
                      <ul>
                        <li>Six CPU/FPU library variants are tracked.</li>
                        <li>Node-style and web-style APIs are bundled in extended.js.</li>
                        <li>Reaction/BOOPSI wrappers let JS scripts build native windows.</li>
                      </ul>
                      <Dialog.Close className="icon-button" aria-label="Close">
                        <X size={18} />
                      </Dialog.Close>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
                <button className="secondary" onClick={() => navigate('overview')}>Read docs</button>
                <a className="secondary" href="../ibrowse/index.html">IBrowse edition</a>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="stats-row" aria-label="Project statistics">
          {stats.map((item) => <StatCard key={item.label} item={item} />)}
        </section>

        <section id="platform" className="band">
          <div className="section-head">
            <span>Platform Shape</span>
            <h2>Built like Amiga software, not just cross-compiled.</h2>
          </div>
          <div className="pillar-grid">
            {pillars.map((pillar, index) => {
              const Icon = iconMap[index];
              return (
                <article className="pillar" key={pillar.title}>
                  <Icon size={24} aria-hidden="true" />
                  <h3>{pillar.title}</h3>
                  <p>{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="apis" className="split band warm">
          <div>
            <div className="section-head">
              <span>API Coverage</span>
              <h2>Modern scripting with classic constraints respected.</h2>
            </div>
            <Accordion.Root type="single" collapsible defaultValue="Runtime" className="accordion">
              {modules.map((group) => (
                <Accordion.Item key={group.name} value={group.name} className="accordion-item">
                  <Accordion.Trigger className="accordion-trigger">
                    {group.name}
                    <span>+</span>
                  </Accordion.Trigger>
                  <Accordion.Content className="accordion-content">
                    <div className="chips">
                      {group.items.map((item) => <span key={item}>{item}</span>)}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
          <div className="compat-panel">
            <h3>Compatibility target</h3>
            <p>
              Useful Node compatibility for scripts people actually write, not
              perfect server-side Node parity. Missing or skipped modules have an
              AmigaOS rationale instead of pretending fork, V8, or daemon APIs exist.
            </p>
            <div className="progress-list">
              <label>Runtime core <Progress.Root value={95}><Progress.Indicator style={{ transform: 'translateX(-5%)' }} /></Progress.Root></label>
              <label>Node-style APIs <Progress.Root value={72}><Progress.Indicator style={{ transform: 'translateX(-28%)' }} /></Progress.Root></label>
              <label>Native GUI bridge <Progress.Root value={80}><Progress.Indicator style={{ transform: 'translateX(-20%)' }} /></Progress.Root></label>
            </div>
          </div>
        </section>

        <section id="builds" className="band">
          <div className="section-head">
            <span>Build Matrix</span>
            <h2>One JavaScript platform across several real Amiga profiles.</h2>
          </div>
          <div className="target-grid">
            {project.targets.map((target) => (
              <Tooltip.Root key={target}>
                <Tooltip.Trigger asChild>
                  <div className="target">
                    <Cpu size={20} aria-hidden="true" />
                    <span>{target}</span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="tooltip" sideOffset={8}>
                    Built as a self-identifying quickjs.{target.replace(' ', '')}.library variant.
                    <Tooltip.Arrow className="tooltip-arrow" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
          </div>
          <div className="timeline">
            {timeline.map(([version, text]) => (
              <div className="timeline-item" key={version}>
                <strong>{version}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="examples" className="band examples">
          <div className="section-head">
            <span>Examples</span>
            <h2>CLI, compatibility APIs, and native windows from the same runtime.</h2>
          </div>
          <Tabs.Root defaultValue="cli" className="tabs">
            <Tabs.List className="tabs-list" aria-label="Example selector">
              <Tabs.Trigger value="cli"><Terminal size={16} /> CLI</Tabs.Trigger>
              <Tabs.Trigger value="node"><Blocks size={16} /> APIs</Tabs.Trigger>
              <Tabs.Trigger value="reaction"><Monitor size={16} /> Reaction</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="cli"><CodeBlock>{examples.cli}</CodeBlock></Tabs.Content>
            <Tabs.Content value="node"><CodeBlock>{examples.node}</CodeBlock></Tabs.Content>
            <Tabs.Content value="reaction"><CodeBlock>{examples.reaction}</CodeBlock></Tabs.Content>
          </Tabs.Root>
        </section>

        <section className="band final-band">
          <div>
            <div className="section-head">
              <span>Release Posture</span>
              <h2>Honest about vintage hardware.</h2>
            </div>
            <p>
              The project tracks current source aggressively, but the release story
              stays grounded: copy the right library to LIBS:, run with a 64K stack,
              and validate on the actual Amiga configuration you care about.
            </p>
          </div>
          <div className="toggle-row">
            <span>Use soft-float by default</span>
            <Switch.Root className="switch" defaultChecked aria-label="Use soft-float by default">
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </section>
      </main>
    </Tooltip.Provider>
  );
}

export default App;
