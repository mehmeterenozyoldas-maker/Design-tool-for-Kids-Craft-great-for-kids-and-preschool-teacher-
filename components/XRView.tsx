import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import { useStore } from '../store';
import { gridToWorld, parseKey } from '../utils/coords';
import { 
    Move, RotateCw, Scaling, Video, AlertCircle, 
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, 
    Plus, Minus, RefreshCw, X, Check, ScanLine
} from 'lucide-react';
import clsx from 'clsx';

// --- Shared Geometry ---
const CylinderGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 32); 

// --- Types ---
interface CalibrationState {
    x: number;
    y: number;
    z: number;
    rotation: number;
    scale: number;
}

const DEFAULT_CALIBRATION: CalibrationState = { x: 0, y: 0, z: -0.5, rotation: 0, scale: 1 };

// --- 3D Content Component ---
const XRContent: React.FC<{ calibration: CalibrationState; showGhost?: boolean }> = ({ calibration, showGhost }) => {
    const { board, cells, palette } = useStore();
    
    // Scale factor: Grid units (cm) to Meters. 1 unit = 1cm = 0.01m
    const BASE_SCALE = 0.01; 
    const finalScale = BASE_SCALE * calibration.scale;

    const width = (board.cols * board.pegPitchMm) / 10; // in cm units
    const depth = (board.rows * board.pegPitchMm) / 10; // in cm units

    return (
        <group 
            position={[calibration.x, calibration.y, calibration.z]} 
            rotation={[0, calibration.rotation, 0]}
            scale={[finalScale, finalScale, finalScale]}
        >
             {/* Ghost Board for Alignment */}
            {showGhost && (
                <group position={[0, -0.5, 0]}>
                    <mesh receiveShadow>
                        <boxGeometry args={[width, 1, depth]} />
                        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} wireframe />
                    </mesh>
                    <mesh position={[0, -0.5, 0]}>
                         <gridHelper args={[Math.max(width, depth) * 2, 20, 0x0ea5e9, 0x333333]} />
                    </mesh>
                </group>
            )}

            {/* Solid Board Base (Invisible in AR mostly, but helps occlusion if we had it) */}
            <mesh position={[0, -0.5, 0]}>
                <boxGeometry args={[width, 0.5, depth]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.1} />
            </mesh>

            {/* Cylinders */}
            {Array.from(cells.entries()).map(([key, colorId]) => {
                const {x, y} = parseKey(key);
                const [px, py, pz] = gridToWorld(x, y, board);
                const color = palette.find(p => p.id === colorId)?.hex;
                return (
                    <mesh key={key} position={[px * 10, py * 10 + 2, pz * 10]} castShadow>
                         <cylinderGeometry args={[2, 2, 4, 32]} />
                         <meshStandardMaterial color={color} />
                    </mesh>
                )
            })}
        </group>
    );
};

// --- Store ---
const store = createXRStore({
    depthSensing: false,
    hitTest: true,
    domOverlay: false // We use our own UI on top for fallback, simpler for now
});

export const XRView: React.FC = () => {
    const [mode, setMode] = useState<'idle' | 'immersive' | 'fallback'>('idle');
    const [isXRSupported, setIsXRSupported] = useState<boolean | null>(null);
    const [calibration, setCalibration] = useState<CalibrationState>(DEFAULT_CALIBRATION);
    const [isCalibrating, setIsCalibrating] = useState(true);
    
    // Fallback Video Ref
    const videoRef = useRef<HTMLVideoElement>(null);

    // Check Support
    useEffect(() => {
        if ('xr' in navigator && (navigator as any).xr) {
            (navigator as any).xr.isSessionSupported('immersive-ar')
                .then((supported: boolean) => setIsXRSupported(supported))
                .catch(() => setIsXRSupported(false));
        } else {
            setIsXRSupported(false);
        }
    }, []);

    // Start WebXR
    const startAR = async () => {
        try {
            if (!isXRSupported) throw new Error("XR not supported");
            await store.enterAR();
            setMode('immersive');
        } catch (e) {
            console.error("XR Error:", e);
            // Auto fallback if XR fails
            startFallback();
        }
    };

    // Start Fallback (Camera Feed)
    const startFallback = async () => {
        setMode('fallback');
        // Reset calibration for camera view (move it further back)
        setCalibration({ ...DEFAULT_CALIBRATION, z: -2, y: -0.5 });
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Camera permission denied. The app will simulate a black background.");
        }
    };

    // Calibration Helpers
    const updateCal = (key: keyof CalibrationState, delta: number) => {
        setCalibration(prev => ({ ...prev, [key]: prev[key] + delta }));
    };

    // --- RENDER ---

    if (mode === 'idle') {
        return (
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-500 to-slate-900 pointer-events-none" />
                
                <div className="z-10 bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full">
                    <h2 className="text-3xl font-bold mb-2">AR Preview</h2>
                    <p className="text-slate-300 mb-8 text-sm">
                        Visualize your pattern in the real world. Point your camera at your table or pegboard.
                    </p>

                    <div className="flex flex-col gap-3">
                        {/* Immersive AR Button */}
                        <button 
                            onClick={startAR}
                            disabled={isXRSupported === false}
                            className={clsx(
                                "flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition text-lg w-full",
                                isXRSupported !== false 
                                    ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg hover:scale-[1.02] active:scale-95" 
                                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                            )}
                        >
                            <ScanLine size={24} />
                            {isXRSupported === null ? "Checking..." : "Start WebXR"}
                        </button>

                        {/* Fallback Button */}
                        <button 
                            onClick={startFallback}
                            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold bg-slate-800 text-white border border-slate-700 shadow hover:bg-slate-700 active:scale-95 transition w-full"
                        >
                            <Video size={20} />
                            Camera Overlay
                        </button>

                        {!isXRSupported && isXRSupported !== null && (
                            <div className="flex items-center gap-2 text-amber-300 text-xs bg-amber-500/10 p-3 rounded-lg text-left border border-amber-500/20">
                                <AlertCircle size={16} className="shrink-0" />
                                <span>WebXR not found. Using camera overlay mode.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- ACTIVE VIEW (Immersive or Fallback) ---

    return (
        <div className="w-full h-full relative bg-black overflow-hidden">
            
            {/* Fallback Camera Layer */}
            {mode === 'fallback' && (
                <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover opacity-100"
                    muted 
                    playsInline 
                />
            )}

            {/* Calibration UI Overlay - Renders ON TOP of Canvas */}
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between safe-area-padding">
                
                {/* Top Bar */}
                <div className="p-4 flex justify-between items-start pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-white/10 backdrop-blur text-white p-2 rounded-full hover:bg-white/20 transition"
                    >
                        <X size={24} />
                    </button>
                    
                    <button 
                        onClick={() => setIsCalibrating(!isCalibrating)}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-2 rounded-full backdrop-blur font-bold transition shadow-lg",
                            isCalibrating ? "bg-brand-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                    >
                        {isCalibrating ? <Check size={18} /> : <Move size={18} />}
                        {isCalibrating ? "Done" : "Adjust"}
                    </button>
                </div>

                {/* Calibration Controls */}
                {isCalibrating && (
                    <div className="p-6 pointer-events-auto bg-black/80 backdrop-blur-xl rounded-t-3xl border-t border-white/10 flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center text-white/60 text-xs uppercase tracking-wider font-bold">
                            <span>Move</span>
                            <span>Transform</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8 items-center">
                            {/* D-Pad for Position */}
                            <div className="relative w-36 h-36 mx-auto">
                                <div className="absolute inset-0 bg-white/5 rounded-full border border-white/10" />
                                
                                <button 
                                    onClick={() => updateCal('y', 0.05)} // Up (Screen Space)
                                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 p-3 active:bg-brand-500/50 transition rounded-full text-white"
                                ><ArrowUp size={24} /></button>
                                
                                <button 
                                    onClick={() => updateCal('y', -0.05)} // Down (Screen Space)
                                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 p-3 active:bg-brand-500/50 transition rounded-full text-white"
                                ><ArrowDown size={24} /></button>
                                
                                <button 
                                    onClick={() => updateCal('x', -0.05)}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 p-3 active:bg-brand-500/50 transition rounded-full text-white"
                                ><ArrowLeft size={24} /></button>
                                
                                <button 
                                    onClick={() => updateCal('x', 0.05)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 p-3 active:bg-brand-500/50 transition rounded-full text-white"
                                ><ArrowRight size={24} /></button>
                                
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                                    <Move size={32} className="text-white" />
                                </div>
                            </div>

                            {/* Rotation & Scale Sliders */}
                            <div className="flex flex-col gap-5">
                                {/* Rotation */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-white/80 text-xs">
                                        <div className="flex items-center gap-1"><RotateCw size={12}/> Rotate</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateCal('rotation', -0.1)} className="w-10 h-10 bg-white/10 rounded-full text-white flex items-center justify-center active:bg-white/20"><RotateCw className="scale-x-[-1]" size={18}/></button>
                                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-500" style={{ width: '50%' }} />
                                        </div>
                                        <button onClick={() => updateCal('rotation', 0.1)} className="w-10 h-10 bg-white/10 rounded-full text-white flex items-center justify-center active:bg-white/20"><RotateCw size={18}/></button>
                                    </div>
                                </div>

                                {/* Scale */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-white/80 text-xs">
                                        <div className="flex items-center gap-1"><Scaling size={12}/> Scale</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateCal('scale', -0.1)} className="w-10 h-10 bg-white/10 rounded-full text-white flex items-center justify-center active:bg-white/20"><Minus size={18}/></button>
                                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, calibration.scale * 50)}%` }} />
                                        </div>
                                        <button onClick={() => updateCal('scale', 0.1)} className="w-10 h-10 bg-white/10 rounded-full text-white flex items-center justify-center active:bg-white/20"><Plus size={18}/></button>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => setCalibration({ ...DEFAULT_CALIBRATION, z: -2, y: -0.5 })}
                                    className="text-xs text-white/40 flex items-center justify-center gap-1 mt-1 hover:text-white transition"
                                >
                                    <RefreshCw size={12} /> Reset to Center
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3D Scene */}
            <Canvas gl={{ alpha: true }} camera={{ position: [0, 0, 0], fov: 75 }}>
                {mode === 'immersive' ? (
                    <XR store={store}>
                        <ambientLight intensity={1} />
                        <directionalLight position={[5, 10, 5]} intensity={2} />
                        <XRContent calibration={calibration} showGhost={isCalibrating} />
                    </XR>
                ) : (
                    <>
                        <ambientLight intensity={1} />
                        <directionalLight position={[2, 5, 2]} intensity={2} />
                        {/* We don't move the camera in fallback, we move the world relative to camera */}
                        <XRContent calibration={calibration} showGhost={isCalibrating} />
                    </>
                )}
            </Canvas>
        </div>
    );
};
