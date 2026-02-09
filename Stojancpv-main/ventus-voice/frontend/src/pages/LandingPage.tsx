import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe, BarChart3, ShieldCheck, Play } from 'lucide-react';
import { HeroGlobe } from '../components/landing/HeroGlobe';
import { Button } from '../components/ui/button';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-void text-text-high selection:bg-primary selection:text-void overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-void/50 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary animate-pulse-live" />
                        <span className="text-xl font-bold tracking-tight">Vora</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/sign-in')} className="text-text-muted hover:text-white">
                            Login
                        </Button>
                        <Button onClick={() => navigate('/sign-up')} className="btn-primary shadow-glow">
                            Get Started
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-20">
                <div className="absolute inset-0 z-0 opacity-40">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            v2.0 Now Live
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight">
                            Voice AI for <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                                Every Language
                            </span>
                        </h1>

                        <p className="text-xl text-text-muted max-w-lg leading-relaxed">
                            Build agents that speak 25+ Arabic dialects, 22 Indian languages, and 7 SEA languages. Native latency, enterprise security.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button size="lg" onClick={() => navigate('/sign-up')} className="btn-primary h-12 px-8 text-lg">
                                Start Building <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button size="lg" variant="outline" className="btn-secondary h-12 px-8 text-lg group">
                                <Play className="mr-2 h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
                                Listen to Samples
                            </Button>
                        </div>

                        <div className="pt-8 border-t border-white/10 flex gap-8 text-sm text-text-muted">
                            <div>
                                <p className="font-bold text-white text-2xl">30+</p>
                                <p>Languages</p>
                            </div>
                            <div>
                                <p className="font-bold text-white text-2xl">0.5s</p>
                                <p>Latency</p>
                            </div>
                            <div>
                                <p className="font-bold text-white text-2xl">100%</p>
                                <p>Uptime</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-[500px] w-full hidden lg:block relative">
                        <Suspense fallback={null}>
                            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                                <HeroGlobe />
                            </Canvas>
                        </Suspense>
                    </div>
                </div>
            </section>

            {/* Bento Grid Features */}
            <section className="py-24 relative bg-surface/30 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Why Vora?</h2>
                        <p className="text-text-muted">Built for the world, not just the valley.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Feature 1 */}
                        <div className="glass-card p-8 md:col-span-2 group hover:-translate-y-1 transition-transform">
                            <Globe className="w-10 h-10 text-primary mb-4" />
                            <h3 className="text-2xl font-bold mb-2">Truly Global</h3>
                            <p className="text-text-muted">
                                While others focus on English, we optimized our models for regional dialects.
                                From Mumbai to Cairo, Vora understands the nuance.
                            </p>
                            <div className="mt-8 h-32 bg-gradient-to-r from-primary/10 to-transparent rounded-lg border border-primary/20 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20" />
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
                            <ShieldCheck className="w-10 h-10 text-success mb-4" />
                            <h3 className="text-2xl font-bold mb-2">Enterprise Ready</h3>
                            <p className="text-text-muted">
                                SOC 2 Compliant, End-to-End Encryption, and Private Cloud deployment options available.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="glass-card p-8 group hover:-translate-y-1 transition-transform">
                            <BarChart3 className="w-10 h-10 text-secondary mb-4" />
                            <h3 className="text-2xl font-bold mb-2">Real-time Analytics</h3>
                            <p className="text-text-muted">
                                Track cost per minute, sentiment analysis, and call success rates in real-time.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="glass-card p-8 md:col-span-2 group hover:-translate-y-1 transition-transform md:col-start-2">
                            <h3 className="text-2xl font-bold mb-2 text-gradient">Self-Serve & Developer First</h3>
                            <p className="text-text-muted mb-6">
                                No sales calls required. Get your API key and start building in under 5 minutes.
                            </p>
                            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm border border-white/10 text-green-400">
                                <span className="text-purple-400">const</span> client = <span className="text-yellow-400">new</span> VoraClient({"{"} apiKey {"}"});<br />
                                <span className="text-purple-400">await</span> client.voice.connect();
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10 bg-void">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-wrap justify-center gap-4 mb-4 text-sm">
                        <a href="/policies/privacy" className="text-text-muted hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/policies/terms" className="text-text-muted hover:text-white transition-colors">Terms of Service</a>
                        <a href="/policies/cookies" className="text-text-muted hover:text-white transition-colors">Cookie Policy</a>
                        <a href="/policies/dpa" className="text-text-muted hover:text-white transition-colors">DPA</a>
                        <a href="/policies/aup" className="text-text-muted hover:text-white transition-colors">Acceptable Use</a>
                    </div>
                    <p className="text-center text-text-muted text-sm">© 2026 Vora AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
