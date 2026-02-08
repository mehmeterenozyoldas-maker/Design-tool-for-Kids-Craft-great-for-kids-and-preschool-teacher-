import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  PerspectiveCamera, 
  ContactShadows, 
  RoundedBox,
  MeshTransmissionMaterial,
  Center
} from '@react-three/drei';
import { useStore } from '../store';
import { gridToWorld, parseKey } from '../utils/coords';

// --- GEOMETRY FACTORY ---

// Create a realistic hollow tube geometry for the beads with bevels
const createBeadGeometry = () => {
    const shape = new THREE.Shape();
    // Outer circle
    shape.absarc(0, 0, 0.22, 0, Math.PI * 2, false);
    // Inner hole
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.14, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    
    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: 0.44, 
        bevelEnabled: true, 
        bevelThickness: 0.02, 
        bevelSize: 0.02, 
        bevelSegments: 3,
        curveSegments: 16 // Optimized for performance
    });
    
    // Center geometry at origin for easier positioning
    geom.center();
    // Rotate to align with Y-up world (Extrude creates along Z)
    geom.rotateX(Math.PI / 2);
    return geom;
};

// Singleton Geometry instances
const BeadGeom = createBeadGeometry();
const PegGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.25, 16);
// Shift peg origin to bottom for easier placement on board
PegGeom.translate(0, 0.125, 0); 

// --- COMPONENTS ---

const Pegs: React.FC = () => {
    const { board } = useStore();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = board.cols * board.rows;

    useEffect(() => {
        if (!meshRef.current) return;
        const tempObj = new THREE.Object3D();
        let i = 0;
        for (let x = 0; x < board.cols; x++) {
            for (let y = 0; y < board.rows; y++) {
                const [px, py, pz] = gridToWorld(x, y, board);
                // Position pegs slightly embedded in board
                tempObj.position.set(px, py + 0.05, pz); 
                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
                i++;
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [board]);

    return (
        <instancedMesh ref={meshRef} args={[PegGeom, undefined, count]} castShadow receiveShadow>
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.2} />
        </instancedMesh>
    );
}

const Cylinders: React.FC = () => {
    const { board, cells, palette } = useStore();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = board.cols * board.rows;
    
    // Create Three.js colors once
    const colorMap = useMemo(() => {
        const map: Record<string, THREE.Color> = {};
        palette.forEach(p => map[p.id] = new THREE.Color(p.hex));
        return map;
    }, [palette]);

    useFrame(() => {
        if (!meshRef.current) return;
        
        let i = 0;
        const tempObj = new THREE.Object3D();
        
        cells.forEach((colorId, key) => {
             const { x, y } = parseKey(key);
             const [px, py, pz] = gridToWorld(x, y, board);
             
             // Position bead on top of board/peg
             // Board surface ~0.05 + Peg height ~0.25
             // Bead center needs to be calculated. 
             // Bead height is 0.44. Center is 0.22.
             // We want it sitting on the board surface (y=0.05 approx)
             tempObj.position.set(px, py + 0.05 + 0.22, pz); 
             
             // Subtle random rotation for realism
             tempObj.rotation.y = (x * 0.5 + y * 0.5); 

             tempObj.updateMatrix();
             
             meshRef.current!.setMatrixAt(i, tempObj.matrix);
             meshRef.current!.setColorAt(i, colorMap[colorId]);
             i++;
        });

        // Move unused instances out of view
        for (let j = i; j < count; j++) {
             tempObj.position.set(0, -100, 0);
             tempObj.updateMatrix();
             meshRef.current!.setMatrixAt(j, tempObj.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        meshRef.current.count = i;
    });

    return (
        <instancedMesh ref={meshRef} args={[BeadGeom, undefined, count]} castShadow receiveShadow>
            <meshPhysicalMaterial 
                roughness={0.2} 
                metalness={0.05} 
                clearcoat={0.6} 
                clearcoatRoughness={0.15}
            />
        </instancedMesh>
    );
};

const BoardBase: React.FC = () => {
    const { board } = useStore();
    const width = (board.cols * board.pegPitchMm) / 10 + 0.6; // Margin
    const depth = (board.rows * board.pegPitchMm) / 10 + 0.6;
    const thickness = 0.15;

    return (
        <group position={[0, -thickness/2, 0]}>
            {/* Main Clear Plastic Board */}
            <RoundedBox args={[width, thickness, depth]} radius={0.15} smoothness={4} castShadow receiveShadow>
                <MeshTransmissionMaterial 
                    backside
                    samples={6} // Keep low for performance, increase for high-end
                    thickness={0.5}
                    roughness={0.1}
                    chromaticAberration={0.04}
                    anisotropy={0.1}
                    color="#ffffff"
                    resolution={512}
                />
            </RoundedBox>
        </group>
    );
}

export const Scene3D: React.FC<{ interactive?: boolean }> = ({ interactive = false }) => {
  const { board, setCell } = useStore();
  const orbitRef = useRef<any>(null);

  // Raycasting for "Play Mode" placement
  const handlePointerDown = (e: any) => {
    if (!interactive) return;
    e.stopPropagation();
    const [hitX, , hitZ] = e.point.toArray();
    
    // Recalculate grid based on board geometry math
    const pitch = board.pegPitchMm / 10;
    const totalWidth = (board.cols - 1) * pitch;
    const totalDepth = (board.rows - 1) * pitch;
    const startX = -totalWidth / 2;
    const startZ = -totalDepth / 2;

    const col = Math.round((hitX - startX) / pitch);
    const row = Math.round((hitZ - startZ) / pitch);

    if (col >= 0 && col < board.cols && row >= 0 && row < board.rows) {
        setCell(col, row);
    }
  };

  return (
    <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
    >
      <PerspectiveCamera makeDefault position={[0, 15, 10]} fov={35} />
      
      {/* High Quality Lighting Setup */}
      <Environment preset="city" background={false} blur={0.6} />
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[8, 15, 8]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      {/* Fill Light */}
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#e0f2fe" />

      <group onPointerDown={handlePointerDown}>
        <BoardBase />
        <Pegs />
        <Cylinders />
      </group>

      <ContactShadows 
        position={[0, -0.1, 0]} 
        opacity={0.5} 
        scale={40} 
        blur={2.5} 
        far={1.5} 
        color="#0f172a" 
      />
      
      <OrbitControls 
        ref={orbitRef} 
        minPolarAngle={0} 
        maxPolarAngle={Math.PI / 2.2} 
        minDistance={5}
        maxDistance={40}
        dampingFactor={0.05}
      />
    </Canvas>
  );
};