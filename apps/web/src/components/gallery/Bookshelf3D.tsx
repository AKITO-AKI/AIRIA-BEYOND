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

const LAYOUT_STORAGE_KEY_V1 = 'airia-bookshelf-layout-v1';
const LAYOUT_STORAGE_KEY_V2 = 'airia-bookshelf-layout-v2';
const LAYOUT_STORAGE_KEY_V3 = 'airia-bookshelf-layout-v3';

type BookshelfLayoutStoreV1 = {
  orderIds?: string[];
  faceOutIds?: Record<string, boolean>;
};

type BookshelfLayoutStoreV2 = {
  slotById?: Record<string, number>;
  faceOutIds?: Record<string, boolean>;
};

type BookPose = { x: number; y: number; yaw?: number };

type BookshelfLayoutStoreV3 = {
  slotById?: Record<string, number>;
  faceOutIds?: Record<string, boolean>;
  poseById?: Record<string, BookPose>;
  yawById?: Record<string, number>;
};

function safeReadJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWriteLayoutStoreV2(next: BookshelfLayoutStoreV2): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY_V2, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function safeWriteLayoutStoreV3(next: BookshelfLayoutStoreV3): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY_V3, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function normalizeSlotById(
  input: Record<string, number> | null | undefined,
  albumIds: string[]
): { slotById: Record<string, number>; changed: boolean } {
  const wanted = new Set(albumIds);
  const next: Record<string, number> = {};
  let changed = false;

  const occupied = new Set<number>();
  const duplicates: string[] = [];

  if (input && typeof input === 'object') {
    for (const [id, rawSlot] of Object.entries(input)) {
      if (!wanted.has(id)) {
        changed = true;
        continue;
      }
      const slot = clampInt(rawSlot, 0, 10_000);
      if (slot === null) {
        changed = true;
        continue;
      }
      if (occupied.has(slot)) {
        duplicates.push(id);
        changed = true;
        continue;
      }
      occupied.add(slot);
      next[id] = slot;
    }
  }

  for (const id of albumIds) {
    if (next[id] !== undefined) continue;
    // Find first free slot.
    let slot = 0;
    while (occupied.has(slot)) slot += 1;
    occupied.add(slot);
    next[id] = slot;
    changed = true;
  }

  // If we had duplicates, assign them after all known ids have slots.
  for (const id of duplicates) {
    if (!wanted.has(id)) continue;
    let slot = 0;
    while (occupied.has(slot)) slot += 1;
    occupied.add(slot);
    next[id] = slot;
  }

  return { slotById: next, changed };
}

function migrateV1ToV2(albumIds: string[]): BookshelfLayoutStoreV2 | null {
  const rawV2 = safeReadJson(LAYOUT_STORAGE_KEY_V2);
  if (rawV2 && typeof rawV2 === 'object') {
    const slotById = rawV2.slotById && typeof rawV2.slotById === 'object' ? (rawV2.slotById as Record<string, number>) : null;
    const faceOutIds = rawV2.faceOutIds && typeof rawV2.faceOutIds === 'object' ? (rawV2.faceOutIds as Record<string, boolean>) : undefined;
    const normalized = normalizeSlotById(slotById, albumIds);
    return { slotById: normalized.slotById, faceOutIds };
  }

  const rawV1 = safeReadJson(LAYOUT_STORAGE_KEY_V1) as BookshelfLayoutStoreV1 | null;
  if (!rawV1 || typeof rawV1 !== 'object') return null;

  const slotById: Record<string, number> = {};
  const order = Array.isArray(rawV1.orderIds) ? rawV1.orderIds : [];
  const wanted = new Set(albumIds);
  let slot = 0;
  for (const id of order) {
    if (!wanted.has(id)) continue;
    slotById[id] = slot;
    slot += 1;
  }
  // Any albums not present in the old order get appended.
  for (const id of albumIds) {
    if (slotById[id] !== undefined) continue;
    slotById[id] = slot;
    slot += 1;
  }

  const faceOutIds = rawV1.faceOutIds && typeof rawV1.faceOutIds === 'object' ? rawV1.faceOutIds : undefined;
  const normalized = normalizeSlotById(slotById, albumIds);
  return { slotById: normalized.slotById, faceOutIds };
}

function migrateToV3(albumIds: string[]): BookshelfLayoutStoreV3 | null {
  const rawV3 = safeReadJson(LAYOUT_STORAGE_KEY_V3);
  if (rawV3 && typeof rawV3 === 'object') {
    const slotById = rawV3.slotById && typeof rawV3.slotById === 'object' ? (rawV3.slotById as Record<string, number>) : null;
    const faceOutIds = rawV3.faceOutIds && typeof rawV3.faceOutIds === 'object' ? (rawV3.faceOutIds as Record<string, boolean>) : undefined;
    const poseById = rawV3.poseById && typeof rawV3.poseById === 'object' ? (rawV3.poseById as Record<string, BookPose>) : undefined;
    const yawById = rawV3.yawById && typeof rawV3.yawById === 'object' ? (rawV3.yawById as Record<string, number>) : undefined;
    const normalized = normalizeSlotById(slotById, albumIds);
    return { slotById: normalized.slotById, faceOutIds, poseById, yawById };
  }

  const v2 = migrateV1ToV2(albumIds);
  if (!v2) return null;
  return { slotById: v2.slotById, faceOutIds: v2.faceOutIds };
}

interface Bookshelf3DProps {
  albums: Album[];
  onBookClick: (albumId: string) => void;
  onBookOpen?: (albumId: string) => void;
  constellationEnabled: boolean;
  inputRef: React.MutableRefObject<BookshelfInputState>;
  layoutEditEnabled: boolean;
  layoutSnapEnabled: boolean;
  layoutResetToken: number;
}

const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  albums,
  onBookClick,
  onBookOpen,
  constellationEnabled: _constellationEnabled,
  inputRef,
  layoutEditEnabled,
  layoutSnapEnabled,
  layoutResetToken,
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

  const albumIds = useMemo(() => albums.map((a) => a.id), [albums]);

  const [slotById, setSlotById] = useState<Record<string, number>>(() => {
    const migrated = migrateToV3(albumIds);
    const normalized = normalizeSlotById(migrated?.slotById ?? null, albumIds);
    return normalized.slotById;
  });

  const [faceOutIds, setFaceOutIds] = useState<Record<string, boolean>>(() => {
    const migrated = migrateToV3(albumIds);
    const raw = migrated?.faceOutIds;
    return raw && typeof raw === 'object' ? raw : {};
  });

  const [poseById, setPoseById] = useState<Record<string, BookPose>>(() => {
    const migrated = migrateToV3(albumIds);
    const raw = migrated?.poseById;
    return raw && typeof raw === 'object' ? raw : {};
  });

  const [yawById, setYawById] = useState<Record<string, number>>(() => {
    const migrated = migrateToV3(albumIds);
    const raw = migrated?.yawById;
    if (raw && typeof raw === 'object') return raw;

    // Legacy: yaw was stored inside poseById.
    const pose = migrated?.poseById;
    const next: Record<string, number> = {};
    if (pose && typeof pose === 'object') {
      for (const [id, p] of Object.entries(pose)) {
        const y = (p as any)?.yaw;
        if (typeof y === 'number' && Number.isFinite(y)) next[id] = y;
      }
    }
    return next;
  });
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
    mode: 'move' | 'rotate';
    startYaw: number;
    tempYaw: number | null;
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
      mode: 'move',
      startYaw: 0,
      tempYaw: null,
    }
  );

  useEffect(() => {
    const normalized = normalizeSlotById(slotById, albumIds);
    if (normalized.changed) setSlotById(normalized.slotById);
  }, [albumIds, slotById]);

  useEffect(() => {
    // Prune stored faceOut ids for removed albums.
    const incoming = new Set(albumIds);
    setFaceOutIds((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [id, v] of Object.entries(prev)) {
        if (!incoming.has(id)) {
          changed = true;
          continue;
        }
        if (v) next[id] = true;
      }
      return changed ? next : prev;
    });
  }, [albumIds]);

  useEffect(() => {
    // Prune yaw ids for removed albums.
    const incoming = new Set(albumIds);
    setYawById((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, yaw] of Object.entries(prev)) {
        if (!incoming.has(id)) {
          changed = true;
          continue;
        }
        const y = typeof yaw === 'number' ? yaw : Number(yaw);
        if (!Number.isFinite(y)) {
          changed = true;
          continue;
        }
        next[id] = y;
      }
      return changed ? next : prev;
    });
  }, [albumIds]);

  useEffect(() => {
    // Prune pose ids for removed albums.
    const incoming = new Set(albumIds);
    setPoseById((prev) => {
      let changed = false;
      const next: Record<string, BookPose> = {};
      for (const [id, pose] of Object.entries(prev)) {
        if (!incoming.has(id)) {
          changed = true;
          continue;
        }
        if (!pose || typeof pose !== 'object') {
          changed = true;
          continue;
        }
        const x = typeof (pose as any).x === 'number' ? (pose as any).x : Number((pose as any).x);
        const y = typeof (pose as any).y === 'number' ? (pose as any).y : Number((pose as any).y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          changed = true;
          continue;
        }
        const yawRaw = (pose as any).yaw;
        const yaw = typeof yawRaw === 'number' && Number.isFinite(yawRaw) ? yawRaw : undefined;
        next[id] = { x, y, yaw };
      }
      return changed ? next : prev;
    });
  }, [albumIds]);

  useEffect(() => {
    safeWriteLayoutStoreV3({ slotById, faceOutIds, poseById, yawById });
  }, [slotById, faceOutIds, poseById, yawById]);

  useEffect(() => {
    if (!layoutResetToken) return;
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY_V3);
      localStorage.removeItem(LAYOUT_STORAGE_KEY_V2);
      localStorage.removeItem(LAYOUT_STORAGE_KEY_V1);
    } catch {
      // ignore
    }

    const nextSlotById: Record<string, number> = {};
    for (let i = 0; i < albumIds.length; i += 1) {
      nextSlotById[albumIds[i]] = i;
    }
    setSlotById(nextSlotById);
    setFaceOutIds({});
    setPoseById({});
    setYawById({});
    setFocusedBookId(null);
  }, [layoutResetToken, albumIds]);

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

  const minSlotsPerShelf = 14;
  const maxUsedSlot = useMemo(() => {
    let m = -1;
    for (const id of albumIds) {
      const v = slotById[id];
      if (typeof v === 'number' && Number.isFinite(v)) m = Math.max(m, Math.trunc(v));
    }
    return m;
  }, [albumIds, slotById]);

  const shelves = Math.max(
    3,
    Math.ceil(Math.max(1, albumIds.length, maxUsedSlot + 1) / minSlotsPerShelf)
  );
  const bookSlotSpacing = 0.30;
  const bookWidth = 0.22;
  const sidePadding = 0.60;
  const slotsPerShelf = minSlotsPerShelf;
  const shelfInnerWidth = (slotsPerShelf - 1) * bookSlotSpacing + bookWidth;
  const shelfOuterWidth = shelfInnerWidth + sidePadding * 2;

  const shelfYs = useMemo(() => {
    // Top -> bottom. Tune for current camera.
    const topY = 1.35;
    const spacing = 1.30;
    return Array.from({ length: shelves }, (_, i) => topY - i * spacing);
  }, [shelves]);

  const frameDims = useMemo(() => {
    const topFrameY = shelfYs[0] + 0.60;
    const bottomFrameY = shelfYs[shelfYs.length - 1] - 0.72;
    const height = Math.max(3.8, topFrameY - bottomFrameY);
    const centerY = (topFrameY + bottomFrameY) / 2;
    return { topFrameY, bottomFrameY, height, centerY };
  }, [shelfYs]);

  const maxPan = useMemo(() => {
    const pad = 0.4;
    return Math.max(0, shelfOuterWidth / 2 - viewport.width / 2 + pad);
  }, [shelfOuterWidth, viewport.width]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
    setFocusedBookId(null);
    if (!dragRef.current.activeId) {
      inputRef.current.blockPan = false;
    }
  };

  const toggleFaceOut = (albumId: string) => {
    setFaceOutIds((prev) => {
      const next = { ...prev, [albumId]: !prev[albumId] };
      if (!next[albumId]) delete next[albumId];
      return next;
    });
  };

  const rotateBook = (albumId: string, dir: -1 | 1) => {
    const step = (Math.PI / 12) * dir; // 15deg
    setYawById((prev) => ({ ...prev, [albumId]: (prev[albumId] ?? 0) + step }));
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
    dragRef.current.mode = e?.shiftKey ? 'rotate' : 'move';
    dragRef.current.startYaw = yawById[albumId] ?? 0;
    dragRef.current.tempYaw = null;
    dragRef.current.startClientX = Number(e?.clientX ?? e?.nativeEvent?.clientX ?? 0);
    dragRef.current.startClientY = Number(e?.clientY ?? e?.nativeEvent?.clientY ?? 0);
    const pose = poseById[albumId];
    const p = slotToPos(slotIndex);
    dragRef.current.dragPos = {
      x: pose?.x ?? p.x,
      y: pose?.y ?? p.y,
      z: 0.85,
    };
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

    if (dragRef.current.mode === 'rotate') {
      // Pixel -> yaw. Keep it gentle.
      const yaw = dragRef.current.startYaw + dx * 0.012;
      dragRef.current.tempYaw = yaw;
      // Keep book near its current pos while rotating.
      const current = dragRef.current.dragPos;
      if (current) {
        dragRef.current.dragPos = { ...current };
      }
      return;
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

    const mode = dragRef.current.mode;
    const tempYaw = dragRef.current.tempYaw;

    dragRef.current.activeId = null;
    dragRef.current.pointerId = null;
    dragRef.current.startSlot = -1;
    dragRef.current.hoverSlot = -1;
    dragRef.current.moved = false;
    dragRef.current.dragPos = null;
    dragRef.current.mode = 'move';
    dragRef.current.startYaw = 0;
    dragRef.current.tempYaw = null;
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

    if (mode === 'rotate') {
      if (typeof tempYaw === 'number' && Number.isFinite(tempYaw)) {
        setYawById((prev) => ({ ...prev, [albumId]: tempYaw }));
      }
      return;
    }

    if (layoutEditEnabled) {
      const dp = dragRef.current.dragPos;
      const localX = dp?.x ?? 0;
      const localY = dp?.y ?? 0;
      const x = clamp(localX, -shelfInnerWidth / 2, shelfInnerWidth / 2);
      const y = clamp(localY, shelfYs[shelfYs.length - 1], shelfYs[0]);

      if (layoutSnapEnabled) {
        const snappedSlot = pointToSlot(new THREE.Vector3(x, y, 0));
        if (from >= 0 && snappedSlot >= 0 && from !== snappedSlot) {
          setSlotById((prev) => {
            const safeFrom = Math.max(0, from);
            const safeTo = Math.max(0, snappedSlot);

            let occupantId: string | null = null;
            for (const [id, slot] of Object.entries(prev)) {
              if (id === albumId) continue;
              if (Math.trunc(slot) === safeTo) {
                occupantId = id;
                break;
              }
            }

            const next = { ...prev, [albumId]: safeTo };
            if (occupantId) next[occupantId] = safeFrom;
            return next;
          });
        }

        setPoseById((prev) => {
          if (!prev[albumId]) return prev;
          const next = { ...prev };
          delete next[albumId];
          return next;
        });
      } else {
        setPoseById((prev) => {
          const yaw = prev[albumId]?.yaw;
          return { ...prev, [albumId]: { x, y, yaw } };
        });
      }
      return;
    }

    if (from >= 0 && to >= 0 && from !== to) {
      setSlotById((prev) => {
        const safeFrom = Math.max(0, from);
        const safeTo = Math.max(0, to);

        // Find the occupant in the target slot, if any.
        let occupantId: string | null = null;
        for (const [id, slot] of Object.entries(prev)) {
          if (id === albumId) continue;
          if (Math.trunc(slot) === safeTo) {
            occupantId = id;
            break;
          }
        }

        const next = { ...prev, [albumId]: safeTo };
        if (occupantId) {
          next[occupantId] = safeFrom;
        }
        return next;
      });
    }
  };

  const handleDoubleClick = (albumId: string) => {
    // Pull book to camera and show cover.
    setFocusedBookId((prev) => (prev === albumId ? null : albumId));
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
          <planeGeometry
            args={[
              Math.max(14, shelfOuterWidth + 4),
              Math.max(7, (shelfYs[0] - shelfYs[shelfYs.length - 1]) + 5.2),
            ]}
          />
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
          <mesh position={[-shelfOuterWidth / 2 + 0.08, frameDims.centerY, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, frameDims.height, 0.9]} />
            <meshToonMaterial ref={shelfMatRef} color="#ffffff" gradientMap={toonGradient} />
          </mesh>
          <mesh position={[shelfOuterWidth / 2 - 0.08, frameDims.centerY, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, frameDims.height, 0.9]} />
            <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
          </mesh>

          {/* Top / bottom */}
          <mesh position={[0, frameDims.topFrameY, 0]} castShadow receiveShadow>
            <boxGeometry args={[shelfOuterWidth, 0.18, 0.9]} />
            <meshToonMaterial color="#ffffff" gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, frameDims.bottomFrameY, 0]} castShadow receiveShadow>
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

        {/* Hover slot highlight while dragging (slot mode or snap mode) */}
        {hoverSlot >= 0 && (!layoutEditEnabled || layoutSnapEnabled) ? (
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
          {albumIds
            .slice()
            .sort((a, b) => {
              const sa = slotById[a] ?? 999999;
              const sb = slotById[b] ?? 999999;
              if (sa !== sb) return sa - sb;
              // Stable fallback: createdAt desc.
              const aa = booksById.get(a);
              const bb = booksById.get(b);
              return String(bb?.createdAt ?? '').localeCompare(String(aa?.createdAt ?? ''));
            })
            .map((albumId) => {
          const album = booksById.get(albumId);
          if (!album) return null;

            const slotIndex = slotById[albumId] ?? 0;
            const p = slotToPos(slotIndex);
          const isDragging = dragRef.current.activeId === albumId;
          const dragPos = isDragging ? dragRef.current.dragPos : null;
          const isFocused = focusedBookId === albumId;
          const shouldDim = isFocusMode && !isFocused;

            const pose = poseById[albumId];
            const posed = pose && typeof pose.x === 'number' && typeof pose.y === 'number';

          const basePosition: [number, number, number] = dragPos
            ? [dragPos.x, dragPos.y, dragPos.z]
            : [
                posed ? pose.x : p.x,
                posed ? pose.y : p.y,
                (isFocusMode && !isFocused ? 0.12 : 0.25),
              ];

            const isDraggingThis = isDragging;
            const liveYaw =
              isDraggingThis && dragRef.current.activeId === albumId && dragRef.current.mode === 'rotate'
                ? dragRef.current.tempYaw
                : null;
            const yaw = typeof liveYaw === 'number' && Number.isFinite(liveYaw) ? liveYaw : (yawById[albumId] ?? 0);

          return (
            <Book3D
              key={album.id}
              album={album}
              basePosition={basePosition}
              isFocused={isFocused}
              dimmed={shouldDim}
              focusedPosition={focusedPosition}
              faceOut={Boolean(faceOutIds[album.id])}
              yaw={yaw}
              dragging={isDragging}
              onPointerDown={(e) => beginDrag(album.id, e, slotIndex)}
              onPointerMove={(e) => updateDrag(e)}
              onPointerUp={(e) => endDrag(album.id, e)}
              onContextMenu={() => toggleFaceOut(album.id)}
              onToggleFaceOut={() => toggleFaceOut(album.id)}
              onRotateLeft={() => rotateBook(album.id, -1)}
              onRotateRight={() => rotateBook(album.id, 1)}
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
