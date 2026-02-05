import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Album } from '../../contexts/AlbumContext';
import Book3D from './Book3D';
import type { BookshelfInputState } from './BookshelfCanvas';
import {
  createNoiseTexture,
  createToonGradientTexture,
  patchMaterialWithGrain,
  updateMaterialGrainTime,
} from './toonTextures';

interface Bookshelf3DProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  onBookOpen?: (albumId: string) => void;
  constellationEnabled: boolean;
  inputRef: React.MutableRefObject<BookshelfInputState>;
}

const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  albums,
  onBookClick,
  onBookOpen,
  constellationEnabled: _constellationEnabled,
  inputRef,
}) => {
  const { viewport } = useThree();
  const shelfGroupRef = useRef<THREE.Group>(null);

  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);

  const toonGradient = useMemo(() => createToonGradientTexture(4), []);
  const noiseTex = useMemo(() => createNoiseTexture(64), []);

  const floorMatRef = useRef<THREE.MeshToonMaterial>(null);
  const wallMatRef = useRef<THREE.MeshToonMaterial>(null);
  const shelfMatRef = useRef<THREE.MeshToonMaterial>(null);

  useEffect(() => {
    patchMaterialWithGrain(floorMatRef.current, noiseTex, { strength: 0.07, scale: 14, speed: 0.25 });
    patchMaterialWithGrain(wallMatRef.current, noiseTex, { strength: 0.05, scale: 10, speed: 0.18 });
    patchMaterialWithGrain(shelfMatRef.current, noiseTex, { strength: 0.08, scale: 16, speed: 0.22 });

    return () => {
      toonGradient.dispose();
      noiseTex.dispose();
    };
  }, [noiseTex, toonGradient]);

  const [orderIds, setOrderIds] = useState<string[]>(() => albums.map((a) => a.id));
  const [faceOutIds, setFaceOutIds] = useState<Record<string, boolean>>({});
  const [focusedBookId, setFocusedBookId] = useState<string | null>(null);

  const isFocusMode = focusedBookId !== null;

  const panXRef = useRef(0);
  const panVRef = useRef(0);

  const dragRef = useRef<{
    activeId: string | null;
    pointerId: number | null;
    startSlot: number;
    hoverSlot: number;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    dragPos: { x: number; y: number; z: number } | null;
  }>(
    {
      activeId: null,
      pointerId: null,
      startSlot: -1,
      hoverSlot: -1,
      moved: false,
      startClientX: 0,
      startClientY: 0,
      dragPos: null,
    }
  );

  useEffect(() => {
    // Keep existing order where possible; prepend any new albums (newest-first input).
    setOrderIds((prev) => {
      const incoming = albums.map((a) => a.id);
      const prevSet = new Set(prev);
      const next: string[] = [];
      for (const id of incoming) {
        if (!prevSet.has(id)) next.push(id);
      }
      // Preserve previous order for existing ids.
      for (const id of prev) {
        if (incoming.includes(id)) next.push(id);
      }
      return next.length ? next : incoming;
    });
  }, [albums]);

  useEffect(() => {
    // While a book is focused, disable shelf panning to avoid accidental camera motion.
    if (focusedBookId) {
      inputRef.current.blockPan = true;
    } else if (!dragRef.current.activeId) {
      inputRef.current.blockPan = false;
    }
  }, [focusedBookId, inputRef]);

  const booksById = useMemo(() => {
    const map = new Map<string, Album>();
    for (const a of albums) map.set(a.id, a);
    return map;
  }, [albums]);

  const shelves = 3;
  const bookSlotSpacing = 0.30;
  const bookWidth = 0.22;
  const sidePadding = 0.60;
  const minSlotsPerShelf = 14;
  const slotsPerShelf = Math.max(minSlotsPerShelf, Math.ceil(Math.max(1, orderIds.length) / shelves));
  const shelfInnerWidth = (slotsPerShelf - 1) * bookSlotSpacing + bookWidth;
  const shelfOuterWidth = shelfInnerWidth + sidePadding * 2;

  const shelfYs = useMemo(() => {
    // Top -> bottom. Tune for current camera.
    return [1.35, 0.05, -1.25];
  }, []);

  const maxPan = useMemo(() => {
    const pad = 0.4;
    return Math.max(0, shelfOuterWidth / 2 - viewport.width / 2 + pad);
  }, [shelfOuterWidth, viewport.width]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const moveItem = (arr: string[], from: number, to: number) => {
    const next = arr.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const slotToPos = (slotIndex: number) => {
    const safe = Math.max(0, slotIndex);
    const shelfIndex = Math.min(shelves - 1, Math.floor(safe / slotsPerShelf));
    const col = safe % slotsPerShelf;
    const x = -shelfInnerWidth / 2 + col * bookSlotSpacing;
    const y = shelfYs[shelfIndex] ?? shelfYs[0];
    const z = 0;
    return { x, y, z, shelfIndex, col };
  };

  const focusedPosition: [number, number, number] = [0, 0.55, 1.55];

  const clearFocus = () => {
    setFocusedBookId((prev) => {
      if (!prev) return null;
      const id = prev;
      setFaceOutIds((m) => ({ ...m, [id]: false }));
      return null;
    });
    if (!dragRef.current.activeId) {
      inputRef.current.blockPan = false;
    }
  };

  const pointToSlot = (p: THREE.Vector3) => {
    // p is in shelfGroup local coords.
    const shelfIndex = clamp(
      Math.round(
        (shelfYs[0] - p.y) /
          (shelfYs[0] - shelfYs[shelfYs.length - 1]) *
          (shelves - 1)
      ),
      0,
      shelves - 1
    );

    // Determine nearest shelf by absolute y distance.
    let nearestShelf = 0;
    let bestDy = Infinity;
    for (let i = 0; i < shelfYs.length; i += 1) {
      const dy = Math.abs(p.y - shelfYs[i]);
      if (dy < bestDy) {
        bestDy = dy;
        nearestShelf = i;
      }
    }

    const xClamped = clamp(p.x, -shelfInnerWidth / 2, shelfInnerWidth / 2);
    const col = clamp(Math.round((xClamped + shelfInnerWidth / 2) / bookSlotSpacing), 0, slotsPerShelf - 1);
    return nearestShelf * slotsPerShelf + col;
  };

  useFrame((_, dt) => {
    const input = inputRef.current;

    const isBookDragging = Boolean(dragRef.current.activeId);
    if (isBookDragging) {
      input.wheelPx = 0;
      input.dragPx = 0;
      input.isDragging = false;
      return;
    }

    // Convert pixels -> world units
    const pxToWorld = 0.0022;
    const wheelWorld = input.wheelPx * pxToWorld;
    const dragWorld = input.dragPx * pxToWorld;

    if (wheelWorld !== 0) {
      panVRef.current += wheelWorld * 26;
      input.wheelPx = 0;
    }

    if (dragWorld !== 0) {
      panXRef.current += dragWorld;
      panVRef.current = THREE.MathUtils.lerp(panVRef.current, dragWorld * 60, 0.35);
      input.dragPx = 0;
    }

    // Inertia
    const friction = input.isDragging ? 0.88 : 0.92;
    panVRef.current *= Math.pow(friction, dt * 60);
    panXRef.current += panVRef.current * dt;

    // Bounds + spring
    const spring = 32;
    if (panXRef.current < -maxPan) {
      panXRef.current = -maxPan;
      panVRef.current *= -0.35;
    } else if (panXRef.current > maxPan) {
      panXRef.current = maxPan;
      panVRef.current *= -0.35;
    }

    if (panXRef.current < -maxPan) {
      panVRef.current += (-maxPan - panXRef.current) * spring * dt;
    } else if (panXRef.current > maxPan) {
      panVRef.current -= (panXRef.current - maxPan) * spring * dt;
    }

    if (shelfGroupRef.current) {
      shelfGroupRef.current.position.x = clamp(panXRef.current, -maxPan, maxPan);
    }

    // Limited-animation feel: quantized light flicker (subtle)
    const time = _.clock.elapsedTime;
    const stepped = Math.floor(time * 12) / 12;
    if (keyLightRef.current) {
      keyLightRef.current.intensity = 0.78 + (Math.sin(stepped * 1.2) * 0.04);
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = 0.24 + (Math.cos(stepped * 1.05) * 0.02);
    }

    updateMaterialGrainTime(floorMatRef.current, time);
    updateMaterialGrainTime(wallMatRef.current, time);
    updateMaterialGrainTime(shelfMatRef.current, time);
  });

  const [hoverSlot, setHoverSlot] = useState<number>(-1);

  const beginDrag = (albumId: string, e: any, slotIndex: number) => {
    inputRef.current.blockPan = true;
    dragRef.current.activeId = albumId;
    dragRef.current.pointerId = Number(e?.pointerId ?? -1);
    dragRef.current.startSlot = slotIndex;
    dragRef.current.hoverSlot = slotIndex;
    dragRef.current.moved = false;
    dragRef.current.startClientX = Number(e?.clientX ?? e?.nativeEvent?.clientX ?? 0);
    dragRef.current.startClientY = Number(e?.clientY ?? e?.nativeEvent?.clientY ?? 0);
    const p = slotToPos(slotIndex);
    dragRef.current.dragPos = { x: p.x, y: p.y, z: 0.85 };
    setHoverSlot(slotIndex);
    try {
      e.stopPropagation?.();
      (e?.nativeEvent?.target as any)?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const updateDrag = (e: any) => {
    const activeId = dragRef.current.activeId;
    if (!activeId) return;
    const pid = dragRef.current.pointerId;
    if (pid !== null && Number(e?.pointerId ?? -1) !== pid) return;
    if (!shelfGroupRef.current) return;

    const cx = Number(e?.clientX ?? e?.nativeEvent?.clientX ?? 0);
    const cy = Number(e?.clientY ?? e?.nativeEvent?.clientY ?? 0);
    const dx = cx - dragRef.current.startClientX;
    const dy = cy - dragRef.current.startClientY;
    if (!dragRef.current.moved && dx * dx + dy * dy > 36) {
      dragRef.current.moved = true;
    }

    // Intersect ray with a plane in front of the shelves.
    const ray: THREE.Ray = e?.ray;
    if (!ray) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.25);
    const hit = new THREE.Vector3();
    const ok = ray.intersectPlane(plane, hit);
    if (!ok) return;

    const local = shelfGroupRef.current.worldToLocal(hit.clone());
    const slot = pointToSlot(local);
    dragRef.current.hoverSlot = slot;
    dragRef.current.dragPos = {
      x: clamp(local.x, -shelfInnerWidth / 2, shelfInnerWidth / 2),
      y: local.y,
      z: 0.85,
    };
    setHoverSlot(slot);
  };

  const endDrag = (albumId: string, e: any) => {
    if (dragRef.current.activeId !== albumId) return;
    const from = dragRef.current.startSlot;
    const to = dragRef.current.hoverSlot;
    const moved = dragRef.current.moved;

    dragRef.current.activeId = null;
    dragRef.current.pointerId = null;
    dragRef.current.startSlot = -1;
    dragRef.current.hoverSlot = -1;
    dragRef.current.moved = false;
    dragRef.current.dragPos = null;
    setHoverSlot(-1);

    inputRef.current.blockPan = false;
    try {
      (e?.nativeEvent?.target as any)?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    if (!moved) {
      // Click/tap.
      if (focusedBookId === albumId) {
        // When already focused, a click opens the album.
        (onBookOpen || onBookClick)(albumId);
      } else {
        onBookClick(albumId);
      }
      return;
    }

    if (from >= 0 && to >= 0 && from !== to) {
      setOrderIds((prev) => {
        const safeFrom = Math.max(0, Math.min(prev.length - 1, from));
        const safeTo = Math.max(0, Math.min(prev.length - 1, to));
        return moveItem(prev, safeFrom, safeTo);
      });
    }
  };

  const handleDoubleClick = (albumId: string) => {
    // Pull book to camera and show cover.
    setFocusedBookId((prev) => (prev === albumId ? null : albumId));
    setFaceOutIds((prev) => ({ ...prev, [albumId]: true }));
    onBookClick(albumId);
  };

  const endDragAny = (e: any) => {
    const id = dragRef.current.activeId;
    if (!id) return;
    endDrag(id, e);
  };

  return (
    <group>
      {/* Soft fog to flatten depth a bit (illustration-like atmosphere) */}
      <fog attach="fog" args={['#f5f1ea', 6.5, 15.5]} />

      {/* Floor */}
      <mesh position={[0, -2.15, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 20]} />
        <meshToonMaterial ref={floorMatRef} color="#f6f0e8" gradientMap={toonGradient} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 0.1, -1.05]} receiveShadow>
        <planeGeometry args={[40, 10]} />
        <meshToonMaterial ref={wallMatRef} color="#fff9f0" gradientMap={toonGradient} />
      </mesh>

      <group ref={shelfGroupRef}>
        {/* Invisible interaction plane (keeps drag tracking even off-book) */}
        <mesh
          position={[0, 0.05, 0.26]}
          onPointerDown={(e) => {
            if (!focusedBookId) return;
            if (dragRef.current.activeId) return;
            e.stopPropagation();
            clearFocus();
          }}
          onPointerMove={(e) => updateDrag(e)}
          onPointerUp={(e) => endDragAny(e)}
          onPointerCancel={(e) => endDragAny(e)}
        >
          <planeGeometry args={[Math.max(14, shelfOuterWidth + 4), 7]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Focus mode: subtle darkening backdrop (non-interactive) */}
        {isFocusMode ? (
          <mesh position={[0, 0.05, -0.15]} raycast={null as any}>
            <planeGeometry args={[Math.max(18, shelfOuterWidth + 10), 9]} />
            <meshBasicMaterial color="#0b0b0b" opacity={0.12} transparent depthWrite={false} />
          </mesh>
        ) : null}

        {/* Bookshelf frame (white) */}
        <group position={[0, 0.05, -0.25]}>
          {/* Side panels */}
          <mesh position={[-shelfOuterWidth / 2 + 0.08, 0.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 3.8, 0.9]} />
            <meshToonMaterial ref={shelfMatRef} color="#ffffff" gradientMap={toonGradient} />
          </mesh>
          <mesh position={[shelfOuterWidth / 2 - 0.08, 0.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 3.8, 0.9]} />
            <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
          </mesh>

          {/* Top / bottom */}
          <mesh position={[0, 1.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[shelfOuterWidth, 0.18, 0.9]} />
            <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, -1.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[shelfOuterWidth, 0.18, 0.9]} />
            <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
          </mesh>

          {/* Shelf planks */}
          {shelfYs.map((y, idx) => (
            <mesh key={idx} position={[0, y - 0.78, 0]} castShadow receiveShadow>
              <boxGeometry args={[shelfOuterWidth - 0.22, 0.14, 0.88]} />
              <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
            </mesh>
          ))}
        </group>

        {/* Hover slot highlight while dragging */}
        {hoverSlot >= 0 ? (
          <mesh
            position={[slotToPos(hoverSlot).x, slotToPos(hoverSlot).y - 0.78 + 0.09, 0.32]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[0.34, 0.72]} />
            <meshStandardMaterial color="#d9d9d9" opacity={0.45} transparent roughness={1} metalness={0} />
          </mesh>
        ) : null}

        {/* Books */}
        {orderIds.map((albumId, slotIndex) => {
          const album = booksById.get(albumId);
          if (!album) return null;

          const p = slotToPos(slotIndex);
          const isDragging = dragRef.current.activeId === albumId;
          const dragPos = isDragging ? dragRef.current.dragPos : null;
          const isFocused = focusedBookId === albumId;
          const shouldDim = isFocusMode && !isFocused;

          const basePosition: [number, number, number] = dragPos
            ? [dragPos.x, dragPos.y, dragPos.z]
            : [p.x, p.y, (isFocusMode && !isFocused ? 0.12 : 0.25)];

          return (
            <Book3D
              key={album.id}
              album={album}
              basePosition={basePosition}
              isFocused={isFocused}
              dimmed={shouldDim}
              focusedPosition={focusedPosition}
              faceOut={Boolean(faceOutIds[album.id])}
              dragging={isDragging}
              onPointerDown={(e) => beginDrag(album.id, e, slotIndex)}
              onPointerMove={(e) => updateDrag(e)}
              onPointerUp={(e) => endDrag(album.id, e)}
              onClick={() => {
                if (focusedBookId === albumId) {
                  (onBookOpen || onBookClick)(albumId);
                } else {
                  onBookClick(albumId);
                }
              }}
              onDoubleClick={() => handleDoubleClick(albumId)}
            />
          );
        })}
      </group>

      {/* Focus mode: gentle key light near the focused book */}
      {isFocusMode ? (
        <pointLight position={[0, 0.8, 3.6]} intensity={0.45} distance={12} decay={2} />
      ) : null}

      {/* Lighting: quiet and readable */}
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#fff6e6', '#e9e2d6', 0.22]} />
      <directionalLight
        ref={keyLightRef}
        position={[4, 6, 6]}
        intensity={0.78}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight ref={fillLightRef} position={[-3, 3, 4]} intensity={0.24} color="#ffe9d6" />
    </group>
  );
};

export default Bookshelf3D;
