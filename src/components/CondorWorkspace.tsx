"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  ArrowLeft,
  ArrowUpRight,
  Box,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Layers3,
  MessageSquare,
  Play,
  RotateCw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import * as THREE from "three";

type CondorView = "overview" | "laboratory" | "condor-x";

type CondorPart = {
  id: string;
  nome: string;
  zona: string;
  status: string;
  progresso: number;
  risco: string;
  resumo: string;
};

const defaultParts: CondorPart[] = [
  { id: "helmet", nome: "Cabeça", zona: "Anatomia e interface", status: "refinamento", progresso: 32, risco: "baixo", resumo: "Crânio, face, visão, audição e proporções craniofaciais do protótipo humano." },
  { id: "chest", nome: "Tórax", zona: "Estrutura humana", status: "simulação", progresso: 42, risco: "baixo", resumo: "Caixa torácica, postura, ergonomia e encaixe humano da estrutura central." },
  { id: "left-arm", nome: "Braço esquerdo", zona: "Controle", status: "conceito", progresso: 18, risco: "baixo", resumo: "Sensores, feedback e controle gestual do lado esquerdo." },
  { id: "right-arm", nome: "Braço direito", zona: "Controle", status: "conceito", progresso: 18, risco: "baixo", resumo: "Sensores e comandos seguros integrados ao lado direito." },
  { id: "legs", nome: "Pernas", zona: "Mobilidade", status: "conceito", progresso: 12, risco: "médio", resumo: "Estrutura passiva, encaixe, equilíbrio e estudo ergonômico." },
  { id: "power", nome: "Núcleo C", zona: "Energia e identidade", status: "conceito seguro", progresso: 18, risco: "alto", resumo: "A marca C concentra a identidade visual e representa apenas energia monitorada de bancada." },
];

const partPlans: Record<string, { next: string; deliverables: string[] }> = {
  helmet: { next: "Refinar proporções craniofaciais e campo de visão.", deliverables: ["Malha craniofacial", "Mapa de visão", "Simetria anatômica"] },
  chest: { next: "Fechar o diagrama do núcleo e da telemetria.", deliverables: ["Arquitetura elétrica", "Layout interno", "Telemetria"] },
  "left-arm": { next: "Prototipar leitura de gesto em bancada.", deliverables: ["Mapa de movimento", "Sensor de gesto", "Feedback visual"] },
  "right-arm": { next: "Projetar comandos e feedback do módulo.", deliverables: ["Controle seguro", "Sensor de posição", "Teste isolado"] },
  legs: { next: "Validar medidas e amplitude de movimento.", deliverables: ["Medidas do corpo", "Articulações passivas", "Teste de equilíbrio"] },
  power: { next: "Validar a marca C e manter energia somente em simulação de bancada.", deliverables: ["Marca C", "Carga estimada", "Plano de proteção"] },
};

const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_ARTX_BASE_PATH ?? ""}${path}`;

async function localSession() {
  const response = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Condor-Client": "hub-local" },
  });
  if (!response.ok) throw new Error("Condor local indisponível");
}

function Hologram({ selected, compact = false, onSelect }: { selected: string; compact?: boolean; onSelect?: (id: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(compact ? 31 : 29, 1, 0.1, 20);
    camera.position.set(0, 0.93, compact ? 4.05 : 3.75);
    camera.lookAt(0, 0.9, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cursor = onSelect ? "grab" : "default";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x75eaff, 0x080a18, 2.1));
    const keyLight = new THREE.DirectionalLight(0x8fefff, 3.2);
    keyLight.position.set(2.4, 3.2, 3.8);
    scene.add(keyLight);
    const violetLight = new THREE.DirectionalLight(0x7054ff, 2.3);
    violetLight.position.set(-2.6, 1.8, 1.5);
    scene.add(violetLight);

    const rig = new THREE.Group();
    scene.add(rig);
    const body = new THREE.Group();
    rig.add(body);

    const baseFill = new THREE.MeshStandardMaterial({ color: 0x2f6973, emissive: 0x08677b, emissiveIntensity: 0.3, metalness: 0.08, roughness: 0.58, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const selectedFill = new THREE.MeshStandardMaterial({ color: 0x81552c, emissive: 0xff8a20, emissiveIntensity: 0.7, metalness: 0.06, roughness: 0.52, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
    const baseWire = new THREE.MeshBasicMaterial({ color: 0x79efff, wireframe: true, transparent: true, opacity: 0.1, depthWrite: false });
    const selectedWire = new THREE.MeshBasicMaterial({ color: 0xffbf67, wireframe: true, transparent: true, opacity: 0.66, depthWrite: false });
    const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x28535b, emissive: 0x1b7182, emissiveIntensity: 0.3, metalness: 0.08, roughness: 0.6 });
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0xffa13c, emissive: 0xff7b18, emissiveIntensity: 2.3, metalness: 0.28, roughness: 0.18 });
    const coreBackMaterial = new THREE.MeshStandardMaterial({ color: 0x071219, metalness: 0.85, roughness: 0.22, transparent: true, opacity: 0.82 });
    const featureMaterial = new THREE.MeshStandardMaterial({ color: 0xb7f7ff, emissive: 0x35cdeb, emissiveIntensity: 0.9, metalness: 0.02, roughness: 0.42 });
    const darkFeatureMaterial = new THREE.MeshStandardMaterial({ color: 0x07151c, emissive: 0x0d6072, emissiveIntensity: 0.55, metalness: 0.03, roughness: 0.68 });
    const anatomyDetail = new THREE.MeshStandardMaterial({ color: 0x7be6ed, emissive: 0x1b8fa2, emissiveIntensity: 0.4, metalness: 0.04, roughness: 0.62, transparent: true, opacity: 0.66 });
    const softLine = new THREE.MeshBasicMaterial({ color: 0x7367ff, wireframe: true, transparent: true, opacity: 0.24 });
    const interactiveMeshes: THREE.Mesh[] = [];

    const addAnatomy = (
      geometry: THREE.BufferGeometry,
      position: [number, number, number],
      scale: [number, number, number],
      id: string,
      rotation: [number, number, number] = [0, 0, 0],
      wire = true,
    ) => {
      const group = new THREE.Group();
      group.position.set(...position);
      group.scale.set(...scale);
      group.rotation.set(...rotation);
      const active = id === selected;
      const surface = new THREE.Mesh(geometry, active ? selectedFill : baseFill);
      surface.userData.id = id;
      group.add(surface);
      interactiveMeshes.push(surface);
      if (wire) {
        const grid = new THREE.Mesh(geometry.clone(), active ? selectedWire : baseWire);
        grid.scale.setScalar(1.008);
        group.add(grid);
      }
      body.add(group);
      return group;
    };

    const addJoint = (position: [number, number, number], scale: [number, number, number], id: string) => {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), id === selected ? selectedFill : jointMaterial);
      joint.position.set(...position);
      joint.scale.set(...scale);
      joint.userData.id = id;
      body.add(joint);
      interactiveMeshes.push(joint);
    };

    const addBetween = (start: THREE.Vector3, end: THREE.Vector3, radiusTop: number, radiusBottom: number, id: string) => {
      const direction = end.clone().sub(start);
      const center = start.clone().add(end).multiplyScalar(0.5);
      const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), 24, 6, false);
      const group = addAnatomy(geometry, [center.x, center.y, center.z], [1, 1, 1], id);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      return group;
    };

    const createOrganicGeometry = (profile: Array<[number, number, number]>, radialSegments = 48) => {
      const vertices: number[] = [];
      const indices: number[] = [];
      for (const [y, radiusX, radiusZ] of profile) {
        for (let segment = 0; segment < radialSegments; segment += 1) {
          const angle = (segment / radialSegments) * Math.PI * 2;
          vertices.push(Math.cos(angle) * radiusX, y, Math.sin(angle) * radiusZ);
        }
      }
      for (let ring = 0; ring < profile.length - 1; ring += 1) {
        for (let segment = 0; segment < radialSegments; segment += 1) {
          const next = (segment + 1) % radialSegments;
          const currentRing = ring * radialSegments;
          const nextRing = (ring + 1) * radialSegments;
          indices.push(currentRing + segment, nextRing + segment, nextRing + next);
          indices.push(currentRing + segment, nextRing + next, currentRing + next);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const addOrganicBetween = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      profile: Array<[number, number, number]>,
      id: string,
    ) => {
      const direction = end.clone().sub(start);
      const center = start.clone().add(end).multiplyScalar(0.5);
      const length = direction.length();
      const geometry = createOrganicGeometry(profile.map(([position, radiusX, radiusZ]) => [
        (position - 0.5) * length,
        radiusX,
        radiusZ,
      ]));
      const group = addAnatomy(geometry, [center.x, center.y, center.z], [1, 1, 1], id);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      return group;
    };

    // Cabeça humana de alta definição: crânio, face, mandíbula, orelhas e pescoço.
    addAnatomy(new THREE.SphereGeometry(1, 48, 36), [0, 1.685, 0], [0.108, 0.137, 0.102], "helmet");
    addAnatomy(new THREE.SphereGeometry(1, 44, 32), [0, 1.622, 0.016], [0.092, 0.092, 0.088], "helmet");
    addAnatomy(new THREE.CapsuleGeometry(0.055, 0.08, 10, 20), [0, 1.535, 0], [1, 1, 0.92], "chest");
    addAnatomy(new THREE.SphereGeometry(1, 24, 18), [-0.11, 1.68, 0], [0.017, 0.033, 0.012], "helmet", [0, 0, 0], false);
    addAnatomy(new THREE.SphereGeometry(1, 24, 18), [0.11, 1.68, 0], [0.017, 0.033, 0.012], "helmet", [0, 0, 0], false);
    for (const side of [-1, 1] as const) {
      const earInner = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0023, 8, 26), anatomyDetail);
      earInner.position.set(side * 0.112, 1.68, 0.009);
      earInner.scale.set(0.75, 1.45, 0.6);
      body.add(earInner);
    }
    const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.044, 6, 18), anatomyDetail);
    noseBridge.position.set(0, 1.676, 0.101);
    body.add(noseBridge);
    addAnatomy(new THREE.ConeGeometry(0.018, 0.052, 20), [0, 1.65, 0.105], [1, 1, 1], "helmet", [Math.PI / 2, 0, 0], false);
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), anatomyDetail);
    noseTip.position.set(0, 1.646, 0.112);
    noseTip.scale.set(0.015, 0.01, 0.01);
    body.add(noseTip);
    addAnatomy(new THREE.SphereGeometry(1, 20, 14), [0, 1.585, 0.035], [0.056, 0.044, 0.068], "helmet", [0, 0, 0], false);
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), featureMaterial);
      eye.position.set(side * 0.039, 1.68, 0.096);
      eye.scale.set(0.012, 0.008, 0.005);
      body.add(eye);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), darkFeatureMaterial);
      iris.position.set(side * 0.039, 1.68, 0.1005);
      iris.scale.set(0.0042, 0.0042, 0.002);
      body.add(iris);
      const upperLid = new THREE.Mesh(new THREE.TorusGeometry(0.0117, 0.00125, 6, 28, Math.PI), anatomyDetail);
      upperLid.position.set(side * 0.039, 1.681, 0.101);
      upperLid.rotation.z = Math.PI;
      upperLid.scale.y = 0.64;
      body.add(upperLid);
      const lowerLid = new THREE.Mesh(new THREE.TorusGeometry(0.0113, 0.0009, 6, 28, Math.PI), anatomyDetail);
      lowerLid.position.set(side * 0.039, 1.679, 0.1005);
      lowerLid.scale.y = 0.58;
      body.add(lowerLid);
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), darkFeatureMaterial);
      nostril.position.set(side * 0.006, 1.644, 0.119);
      nostril.scale.set(0.0022, 0.0015, 0.0015);
      body.add(nostril);
    }
    const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0026, 0.038, 5, 16), anatomyDetail);
    upperLip.position.set(0, 1.619, 0.099);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.scale.z = 0.64;
    body.add(upperLip);
    const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.035, 5, 16), anatomyDetail);
    lowerLip.position.set(0, 1.6125, 0.0985);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.scale.z = 0.7;
    body.add(lowerLip);
    // Sobrancelhas, maçãs do rosto e queixo preservam a leitura humana.
    for (const side of [-1, 1] as const) {
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.038, 5, 16), anatomyDetail);
      brow.position.set(side * 0.039, 1.701, 0.098);
      brow.rotation.z = Math.PI / 2 + side * 0.12;
      body.add(brow);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), anatomyDetail);
      cheek.position.set(side * 0.058, 1.642, 0.083);
      cheek.scale.set(0.025, 0.018, 0.009);
      body.add(cheek);
    }
    const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), anatomyDetail);
    chin.position.set(0, 1.574, 0.073);
    chin.scale.set(0.043, 0.018, 0.015);
    body.add(chin);

    // Planos temporais e linha mandibular quebram a aparência geométrica de boneco.
    for (const side of [-1, 1] as const) {
      const temple = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), anatomyDetail);
      temple.position.set(side * 0.083, 1.702, 0.049);
      temple.scale.set(0.018, 0.028, 0.012);
      body.add(temple);
      const jawLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.073, 5, 18), anatomyDetail);
      jawLine.position.set(side * 0.052, 1.605, 0.069);
      jawLine.rotation.z = side * 0.6;
      body.add(jawLine);
    }

    // Tronco humano contínuo: ombros, caixa torácica, cintura, abdômen e quadril.
    const torsoProfile: Array<[number, number, number]> = [
      [0.915, 0.17, 0.12],
      [0.955, 0.205, 0.14],
      [1.015, 0.218, 0.148],
      [1.085, 0.192, 0.13],
      [1.145, 0.184, 0.122],
      [1.225, 0.205, 0.14],
      [1.315, 0.25, 0.16],
      [1.405, 0.278, 0.165],
      [1.455, 0.245, 0.145],
      [1.495, 0.128, 0.095],
    ];
    addAnatomy(createOrganicGeometry(torsoProfile, 64), [0, 0, 0], [1, 1, 1], "chest");
    addAnatomy(new THREE.SphereGeometry(1, 44, 28), [0, 0.965, 0], [0.21, 0.12, 0.142], "chest");
    addAnatomy(new THREE.CapsuleGeometry(0.03, 0.42, 8, 16), [0, 1.265, -0.115], [1, 1, 0.8], "chest", [0, 0, 0], false);
    for (const side of [-1, 1] as const) {
      const clavicle = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.17, 5, 12), anatomyDetail);
      clavicle.position.set(side * 0.09, 1.445, 0.142);
      clavicle.rotation.z = Math.PI / 2 - side * 0.1;
      body.add(clavicle);
    }
    const sternum = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.22, 5, 12), anatomyDetail);
    sternum.position.set(0, 1.29, 0.151);
    body.add(sternum);
    for (const side of [-1, 1] as const) {
      const pectoral = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), anatomyDetail);
      pectoral.position.set(side * 0.095, 1.34, 0.151);
      pectoral.scale.set(0.092, 0.052, 0.012);
      body.add(pectoral);
      const ribContour = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.0022, 6, 34, Math.PI * 0.8), anatomyDetail);
      ribContour.position.set(side * 0.085, 1.245, 0.143);
      ribContour.rotation.z = side === -1 ? -0.3 : Math.PI + 0.3;
      ribContour.scale.set(0.95, 0.72, 1);
      body.add(ribContour);
    }
    const lineaAlba = new THREE.Mesh(new THREE.CapsuleGeometry(0.0022, 0.24, 5, 14), anatomyDetail);
    lineaAlba.position.set(0, 1.14, 0.13);
    body.add(lineaAlba);
    const navel = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 6, 22), darkFeatureMaterial);
    navel.position.set(0, 1.08, 0.135);
    body.add(navel);

    // Ombros, clavículas e braços em postura humana neutra.
    addBetween(new THREE.Vector3(-0.035, 1.47, 0.075), new THREE.Vector3(-0.245, 1.455, 0.055), 0.026, 0.02, "left-arm");
    addBetween(new THREE.Vector3(0.035, 1.47, 0.075), new THREE.Vector3(0.245, 1.455, 0.055), 0.026, 0.02, "right-arm");
    addJoint([-0.272, 1.438, 0], [0.083, 0.09, 0.09], "left-arm");
    addJoint([0.272, 1.438, 0], [0.083, 0.09, 0.09], "right-arm");
    const leftElbow = new THREE.Vector3(-0.37, 1.155, 0.012);
    const rightElbow = new THREE.Vector3(0.37, 1.155, 0.012);
    const leftWrist = new THREE.Vector3(-0.405, 0.89, 0.028);
    const rightWrist = new THREE.Vector3(0.405, 0.89, 0.028);
    addOrganicBetween(new THREE.Vector3(-0.285, 1.405, 0), leftElbow, [
      [0, 0.068, 0.07], [0.28, 0.078, 0.076], [0.66, 0.068, 0.07], [1, 0.052, 0.054],
    ], "left-arm");
    addOrganicBetween(new THREE.Vector3(0.285, 1.405, 0), rightElbow, [
      [0, 0.068, 0.07], [0.28, 0.078, 0.076], [0.66, 0.068, 0.07], [1, 0.052, 0.054],
    ], "right-arm");
    addJoint([leftElbow.x, leftElbow.y, leftElbow.z], [0.062, 0.066, 0.061], "left-arm");
    addJoint([rightElbow.x, rightElbow.y, rightElbow.z], [0.062, 0.066, 0.061], "right-arm");
    addOrganicBetween(leftElbow, leftWrist, [
      [0, 0.052, 0.054], [0.25, 0.062, 0.06], [0.68, 0.05, 0.047], [1, 0.034, 0.033],
    ], "left-arm");
    addOrganicBetween(rightElbow, rightWrist, [
      [0, 0.052, 0.054], [0.25, 0.062, 0.06], [0.68, 0.05, 0.047], [1, 0.034, 0.033],
    ], "right-arm");
    addJoint([leftWrist.x, leftWrist.y, leftWrist.z], [0.042, 0.045, 0.042], "left-arm");
    addJoint([rightWrist.x, rightWrist.y, rightWrist.z], [0.042, 0.045, 0.042], "right-arm");
    addAnatomy(new THREE.CapsuleGeometry(0.043, 0.095, 8, 18), [-0.41, 0.805, 0.04], [0.92, 1, 0.58], "left-arm");
    addAnatomy(new THREE.CapsuleGeometry(0.043, 0.095, 8, 18), [0.41, 0.805, 0.04], [0.92, 1, 0.58], "right-arm");
    addAnatomy(new THREE.CapsuleGeometry(0.014, 0.065, 5, 10), [-0.455, 0.835, 0.042], [1, 1, 0.65], "left-arm", [0, 0, -0.55], false);
    addAnatomy(new THREE.CapsuleGeometry(0.014, 0.065, 5, 10), [0.455, 0.835, 0.042], [1, 1, 0.65], "right-arm", [0, 0, 0.55], false);
    const fingerLengths = [0.054, 0.062, 0.058, 0.048];
    for (const side of [-1, 1] as const) {
      fingerLengths.forEach((length, index) => {
        const spread = (index - 1.5) * 0.014;
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), anatomyDetail);
        knuckle.position.set(side * (0.41 - spread), 0.757, 0.044);
        knuckle.scale.set(0.008, 0.007, 0.006);
        body.add(knuckle);
        addAnatomy(
          new THREE.CapsuleGeometry(0.0065, length, 5, 9),
          [side * (0.41 - spread), 0.72 - Math.abs(index - 1.5) * 0.003, 0.042],
          [1, 1, 0.72],
          side === -1 ? "left-arm" : "right-arm",
          [0, 0, side * spread * 1.7],
          false,
        );
      });
    }

    // Pernas humanas: coxas, joelhos, panturrilhas, tornozelos e pés.
    const leftHip = new THREE.Vector3(-0.105, 0.93, 0);
    const rightHip = new THREE.Vector3(0.105, 0.93, 0);
    const leftKnee = new THREE.Vector3(-0.112, 0.555, 0.016);
    const rightKnee = new THREE.Vector3(0.112, 0.555, 0.016);
    const leftAnkle = new THREE.Vector3(-0.105, 0.16, 0.004);
    const rightAnkle = new THREE.Vector3(0.105, 0.16, 0.004);
    addJoint([leftHip.x, leftHip.y, leftHip.z], [0.09, 0.096, 0.085], "legs");
    addJoint([rightHip.x, rightHip.y, rightHip.z], [0.09, 0.096, 0.085], "legs");
    addOrganicBetween(leftHip, leftKnee, [
      [0, 0.092, 0.09], [0.2, 0.108, 0.103], [0.58, 0.09, 0.088], [1, 0.061, 0.063],
    ], "legs");
    addOrganicBetween(rightHip, rightKnee, [
      [0, 0.092, 0.09], [0.2, 0.108, 0.103], [0.58, 0.09, 0.088], [1, 0.061, 0.063],
    ], "legs");
    addJoint([leftKnee.x, leftKnee.y, leftKnee.z], [0.075, 0.068, 0.074], "legs");
    addJoint([rightKnee.x, rightKnee.y, rightKnee.z], [0.075, 0.068, 0.074], "legs");
    for (const side of [-1, 1] as const) {
      const patella = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), anatomyDetail);
      patella.position.set(side * 0.112, 0.555, 0.079);
      patella.scale.set(0.04, 0.047, 0.015);
      body.add(patella);
    }
    addOrganicBetween(leftKnee, leftAnkle, [
      [0, 0.061, 0.063], [0.18, 0.07, 0.07], [0.42, 0.076, 0.071], [0.72, 0.055, 0.052], [1, 0.038, 0.04],
    ], "legs");
    addOrganicBetween(rightKnee, rightAnkle, [
      [0, 0.061, 0.063], [0.18, 0.07, 0.07], [0.42, 0.076, 0.071], [0.72, 0.055, 0.052], [1, 0.038, 0.04],
    ], "legs");
    addJoint([leftAnkle.x, leftAnkle.y, leftAnkle.z], [0.048, 0.05, 0.046], "legs");
    addJoint([rightAnkle.x, rightAnkle.y, rightAnkle.z], [0.048, 0.05, 0.046], "legs");
    addAnatomy(new THREE.CapsuleGeometry(0.052, 0.145, 8, 18), [-0.105, 0.075, 0.075], [1, 1, 0.75], "legs", [Math.PI / 2, 0, 0]);
    addAnatomy(new THREE.CapsuleGeometry(0.052, 0.145, 8, 18), [0.105, 0.075, 0.075], [1, 1, 0.75], "legs", [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1] as const) {
      const achilles = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.075, 5, 14), anatomyDetail);
      achilles.position.set(side * 0.105, 0.135, -0.036);
      body.add(achilles);
      const toeLengths = [0.032, 0.038, 0.043, 0.039, 0.032];
      toeLengths.forEach((length, index) => {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, length, 5, 12), anatomyDetail);
        toe.position.set(side * (0.105 + (index - 2) * 0.013), 0.046, 0.161 + length * 0.25);
        toe.rotation.x = Math.PI / 2;
        body.add(toe);
      });
    }

    // Núcleo peitoral: o C é a assinatura do Condor X, sem disco circular.
    const core = new THREE.Group();
    core.position.set(0, 1.355, 0.164);
    const cArc = Math.PI * 1.62;
    const cMark = new THREE.Mesh(new THREE.TorusGeometry(0.069, 0.015, 18, 72, cArc), coreMaterial);
    cMark.rotation.z = Math.PI - cArc / 2;
    cMark.userData.id = "power";
    interactiveMeshes.push(cMark);
    core.add(cMark);
    const cHalo = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.0035, 8, 64, cArc), selected === "power" ? selectedWire : baseWire);
    cHalo.rotation.z = Math.PI - cArc / 2;
    core.add(cHalo);
    const cBackplate = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.008, 48), coreBackMaterial);
    cBackplate.rotation.x = Math.PI / 2;
    cBackplate.position.z = -0.012;
    cBackplate.userData.id = "power";
    interactiveMeshes.push(cBackplate);
    core.add(cBackplate);
    body.add(core);

    // O corpo é normalizado para exatamente 1,80 m do piso ao topo da cabeça.
    const bounds = new THREE.Box3().setFromObject(body);
    const naturalHeight = bounds.max.y - bounds.min.y;
    const exactScale = 1.8 / naturalHeight;
    body.scale.setScalar(exactScale);
    body.position.y = -bounds.min.y * exactScale;

    // Plataforma, grade antropométrica e varredura vertical.
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42 + index * 0.12, 0.0035, 4, 96), softLine);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.005;
      rig.add(ring);
    }
    const floor = new THREE.GridHelper(2.2, 22, 0x2caac5, 0x142c3c);
    floor.position.y = 0;
    floor.material.transparent = true;
    floor.material.opacity = 0.26;
    rig.add(floor);
    const scanMaterial = new THREE.MeshBasicMaterial({ color: 0x92efff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.006), scanMaterial);
    scan.position.set(0, 0.1, 0.32);
    rig.add(scan);

    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array((compact ? 70 : 130) * 3);
    for (let index = 0; index < positions.length / 3; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 1.6;
      positions[index * 3 + 1] = Math.random() * 1.95;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0x5ee4ff, size: 0.006, transparent: true, opacity: 0.48 });
    scene.add(new THREE.Points(particleGeometry, particleMaterial));

    const resize = () => {
      const width = Math.max(host.clientWidth, 250);
      const height = Math.max(host.clientHeight, compact ? 330 : 480);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let manualRotation = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (!onSelect) return;
      dragging = true;
      moved = false;
      lastX = event.clientX;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = event.clientX - lastX;
      if (Math.abs(delta) > 1) moved = true;
      manualRotation += delta * 0.009;
      lastX = event.clientX;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      if (moved || !onSelect) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const target = raycaster.intersectObjects(interactiveMeshes, false)[0]?.object.userData.id;
      if (typeof target === "string") onSelect(target);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const time = (now - start) / 1000;
      rig.rotation.y = manualRotation + Math.sin(time * 0.27) * (compact ? 0.08 : 0.12);
      scan.position.y = 0.08 + ((time * 0.32) % 1.72);
      scanMaterial.opacity = 0.2 + Math.sin(time * 3.1) * 0.08;
      core.scale.setScalar(1 + Math.sin(time * 2.4) * 0.035);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      scene.traverse((item) => {
        if (item instanceof THREE.Mesh || item instanceof THREE.Points || item instanceof THREE.LineSegments) item.geometry.dispose();
      });
      baseFill.dispose();
      selectedFill.dispose();
      baseWire.dispose();
      selectedWire.dispose();
      jointMaterial.dispose();
      coreMaterial.dispose();
      coreBackMaterial.dispose();
      featureMaterial.dispose();
      darkFeatureMaterial.dispose();
      anatomyDetail.dispose();
      softLine.dispose();
      scanMaterial.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [compact, onSelect, selected]);

  return <div ref={mount} className={`condor-hologram ${compact ? "is-compact" : ""}`} role="img" aria-label="Digital twin humano do Condor X com 1,80 metro e 85 quilos" />;
}

export function CondorWorkspace() {
  const [view, setView] = useState<CondorView>("overview");
  const [selectedPart, setSelectedPart] = useState("chest");
  const [parts] = useState<CondorPart[]>(defaultParts);
  const [launching, setLaunching] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = parts.find((part) => part.id === selectedPart) ?? parts[0];
  const progress = useMemo(() => Math.round(parts.reduce((total, part) => total + part.progresso, 0) / Math.max(parts.length, 1)), [parts]);

  function demoOnly() {
    setNotice("Demonstração do Hub: alterações ficam disponíveis somente no app Condor.");
  }

  async function openLocalApp() {
    if (launching) return;
    setLaunching(true);
    try {
      await localSession();
      const response = await fetch("/api/app/abrir", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("aplicativo indisponível");
      setNotice("O aplicativo Condor foi aberto no seu PC.");
    } catch {
      setNotice("Use o atalho Condor na Área de Trabalho para abrir o sistema local.");
    } finally {
      setLaunching(false);
    }
  }

  return <section className="condor-workspace page-enter">
    <header className="condor-workspace-header">
      <div className="condor-identity"><span><BrainCircuit size={20} /></span><div><small>INTELIGÊNCIA ARTX</small><strong>Condor</strong></div></div>
      <nav aria-label="Navegação do Condor">
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>Visão geral</button>
        <button className={view !== "overview" ? "active" : ""} onClick={() => setView("laboratory")}>Laboratório</button>
      </nav>
      <div className="condor-presence demo"><i />Demonstração limitada</div>
    </header>

    {view === "overview" && <div className="condor-overview">
      <section className="condor-hero">
        <div className="condor-hero-copy">
          <p><Sparkles size={13} /> DEMONSTRAÇÃO DO CONDOR</p>
          <h1>Uma visão controlada da inteligência central.</h1>
          <span>O Hub mostra o conceito e o laboratório. Conversas, memória, arquivos e ações do PC existem somente no aplicativo local Condor.</span>
          <div><button className="condor-primary" onClick={() => void openLocalApp()} disabled={launching}><AppWindow size={16} /> {launching ? "Abrindo..." : "Abrir app Condor"}</button><button className="condor-secondary" onClick={() => setView("laboratory")}><FlaskConical size={16} /> Ver demonstração</button></div>
        </div>
        <div className="condor-core-visual" aria-hidden="true">
          <div className="condor-core-orbit orbit-one" /><div className="condor-core-orbit orbit-two" /><div className="condor-core-orbit orbit-three" />
          <div className="condor-core-pulse"><span>C</span><i /></div>
          <small>CONDOR</small>
        </div>
      </section>

      <section className="condor-capabilities">
        <article><MessageSquare size={18} /><span><strong>Conversar</strong><small>Prévia no Hub · uso real no app.</small></span></article>
        <article><Zap size={18} /><span><strong>Executar</strong><small>Ações do PC bloqueadas no Hub.</small></span></article>
        <article><BrainCircuit size={18} /><span><strong>Evoluir</strong><small>Memória privada não exposta aqui.</small></span></article>
      </section>

      <section className="condor-lab-preview">
        <div><p>LABORATÓRIO</p><h2>Protótipos que saem da ideia.</h2><span>O primeiro projeto do laboratório já tem estrutura própria.</span></div>
        <button onClick={() => setView("laboratory")}><span><Box size={18} /></span><div><small>PROJETO 01</small><strong>Condor X</strong><em>Digital twin modular</em></div><ChevronRight size={18} /></button>
      </section>
    </div>}

    {view === "laboratory" && <div className="condor-laboratory">
      <header className="condor-section-title"><div><p><FlaskConical size={13} /> LABORATÓRIO</p><h1>Projetos do Condor</h1><span>Cada projeto nasce como protótipo e ganha sua própria estrutura.</span></div><small>1 PROJETO</small></header>
      <article className="condor-project-post">
        <div className="condor-project-hologram"><div className="condor-project-code"><small>PROJECT</small><strong>CX-01</strong></div><Hologram selected="chest" compact /></div>
        <div className="condor-project-copy"><div className="condor-project-brand"><img src={assetPath("/brand/condor-x.png")} alt="Logo Condor X" /><div><p>PROTÓTIPO EM DESENVOLVIMENTO</p><h2>Condor X</h2></div></div><span>Digital twin humano construído por módulos, com anatomia articulada e referência corporal real.</span><div className="condor-project-stats"><span><strong>{progress}%</strong><small>estrutura</small></span><span><strong>{parts.length}</strong><small>módulos</small></span><span><strong>1,80 m</strong><small>altura</small></span><span><strong>85 kg</strong><small>massa</small></span></div><button onClick={() => setView("condor-x")}>Entrar no projeto <ArrowUpRight size={16} /></button></div>
      </article>
    </div>}

    {view === "condor-x" && selected && <div className="condor-x-page">
      <header className="condor-x-title"><button onClick={() => setView("laboratory")}><ArrowLeft size={15} /> Laboratório</button><div><p>CONDOR X · CX-01</p><h1>Protótipo humano de alta fidelidade</h1><span>Anatomia proporcional, postura neutra e referência corporal real.</span></div><div className="condor-x-progress"><strong>{progress}%</strong><span><i style={{ width: `${progress}%` }} /></span><small>estrutura geral</small></div></header>
      <section className="condor-x-layout">
        <article className="condor-x-stage">
          <div className="condor-stage-corner top-left"><small>DIGITAL TWIN</small><strong>CX-01</strong></div>
          <div className="condor-stage-corner top-right"><small>MÓDULO ATIVO</small><strong>{selected.nome}</strong></div>
          <div className="condor-height-scale" aria-hidden="true"><span>180</span><i /><span>135</span><i /><span>90</span><i /><span>45</span><i /><span>0 cm</span></div>
          <div className="condor-body-specs"><span><strong>1,80 m</strong><small>altura de referência</small></span><span><strong>85 kg</strong><small>massa de referência</small></span></div>
          <Hologram selected={selectedPart} onSelect={setSelectedPart} />
          <div className="condor-rotate-hint"><RotateCw size={12} /> Arraste para girar · clique para selecionar</div>
          <div className="condor-selected-label"><CircleDot size={13} /><span>{selected.nome}</span><small>{selected.status}</small></div>
        </article>

        <aside className="condor-module-panel">
          <div className="condor-module-heading"><div><p>MÓDULOS</p><h2>Corpo do Condor X</h2></div><Layers3 size={18} /></div>
          <div className="condor-module-list">{parts.map((part) => <button key={part.id} className={part.id === selectedPart ? "active" : ""} onClick={() => setSelectedPart(part.id)}><span><strong>{part.nome}</strong><small>{part.zona}</small></span><em>{part.progresso}%</em><i><b style={{ width: `${part.progresso}%` }} /></i></button>)}</div>
          <div className="condor-module-detail"><div><span>{selected.status}</span><small>{selected.zona}</small></div><h3>{selected.nome}</h3><p>{selected.resumo}</p><strong>Próximo passo</strong><p>{partPlans[selected.id]?.next}</p><ul>{partPlans[selected.id]?.deliverables.map((item) => <li key={item}><Target size={12} />{item}</li>)}</ul><button onClick={demoOnly}><Play size={14} /> Somente no app local</button></div>
        </aside>
      </section>
      <footer className="condor-x-safe"><CircleDot size={16} /><span>Protótipo humano digital: anatomia, proporção e ergonomia. O Hub continua sem acesso ao PC.</span></footer>
    </div>}

    {notice && <div className="condor-notice"><RotateCw size={14} />{notice}</div>}
  </section>;
}
