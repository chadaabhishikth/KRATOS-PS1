import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  Home as HomeIcon,
  Video,
  ListCheck,
  Settings as SettingsIcon,
  Clock,
  Radio,
  Eye,
  Camera,
  X,
  OctagonX,
  Zap,
  Database,
  Play,
  Pause,
  Filter,
  Info,
  Save,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  Download,
  Search,
  ShieldCheck,
  Sliders,
  Bell,
  Maximize2,
  Pin,
  CheckCircle2,
  Wrench,
  Activity,
  RotateCcw,
  Hourglass,
  Layers,
} from "lucide-react";

interface ParameterState {
  name: string;
  key: string;
  value: number;
  unit: string;
  status: "Green" | "Blue" | "Yellow" | "Red";
  zone: string;
}

interface TelemetryLog {
  id: string;
  timestamp: string;
  zone: string;
  status: "Green" | "Blue" | "Yellow" | "Red";
  vibration: string;
  temperature: string;
  healthIndex: number;
  isPinned: boolean;
  attended: boolean;
  transitionText?: string;
}

interface ZoneThreshold {
  tempThreshold: number;
  vibThreshold: number;
}

interface ZoneTelemetry {
  temp: number;
  vib: number;
  current: number;
  status: "Green" | "Blue" | "Yellow" | "Red";
  health: number;
  rulDays: number;
  rulPercent: number;
  lastTransitionTime: string;
  lastTransitionEvent: string;
}

interface ManagerProfile {
  id: string;
  name: string;
  role: string;
  division: string;
  avatar: string;
  assignedZones: string[];
}

// NMDC Industrial Divisions (NON-OVERLAPPING SECTORS)
const MANAGERS: ManagerProfile[] = [
  {
    id: "M-101",
    name: "Opr. M. Thorne",
    role: "Shift Supervisor",
    division: "NMDC Sector 1: Primary Ore Crusher & Screening",
    avatar: "MT",
    assignedZones: ["Zone 1", "Zone 2", "Zone 3", "Zone 4"],
  },
  {
    id: "M-102",
    name: "Eng. S. Rao",
    role: "Lead Maintenance Engineer",
    division: "NMDC Sector 2: Ore Beneficiation & Separation",
    avatar: "SR",
    assignedZones: ["Zone 5", "Zone 6", "Zone 7", "Zone 8"],
  },
  {
    id: "M-103",
    name: "Tech. A. Patel",
    role: "Chief Quality Inspector",
    division: "NMDC Sector 3: Stockpile & Wagon Loading Terminal",
    avatar: "AP",
    assignedZones: ["Zone 9", "Zone 10", "Zone 11", "Zone 12"],
  },
];

// Industrial Plant Sector Metadata
const ZONE_METADATA: Record<string, { title: string; component: string }> = {
  "Zone 1": { title: "Primary Ore Crusher Intake", component: "Heavy Jaw Crusher Motor Assembly" },
  "Zone 2": { title: "Secondary Vibrating Screen Deck", component: "Screen Vibrator Drive Motor" },
  "Zone 3": { title: "Overland Conveyor Line A", component: "Main Belt Bearing Shaft" },
  "Zone 4": { title: "Transfer Tower A", component: "Hydraulic Belt Tensioner Pulley" },

  "Zone 5": { title: "Magnetic Ore Separator", component: "Drum Magnet Motor Unit" },
  "Zone 6": { title: "Fine Ore Screening Plant", component: "Vibrator Motor Bearing" },
  "Zone 7": { title: "Overland Conveyor Line B", component: "Drive Pulley Bearing Assembly" },
  "Zone 8": { title: "Transfer Tower B", component: "Chute Diverter Actuator" },

  "Zone 9": { title: "Stacker-Reclaimer Terminal", component: "Boom Conveyor Drive Unit" },
  "Zone 10": { title: "Silo Loading Chute", component: "Pneumatic Gate Valve Motor" },
  "Zone 11": { title: "Wagon Loading Terminal", component: "Tripper Conveyor Drive Pulley" },
  "Zone 12": { title: "Automatic Ore Sampler", component: "Cross-Belt Cutter Motor Assembly" },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "home" | "live" | "workflow_alerts" | "settings" | "history"
  >("home");

  // Manager Credentials & Role Scoping
  const [currentManager, setCurrentManager] = useState<ManagerProfile>(MANAGERS[0]);
  const [showManagerMenu, setShowManagerMenu] = useState<boolean>(false);

  // Simulation Control State
  const [isLiveSimulating, setIsLiveSimulating] = useState<boolean>(true);

  // Critical Pop-Up State & Emergency Stop State
  const [showCriticalModal, setShowCriticalModal] = useState<boolean>(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);
  const [alertFilter, setAlertFilter] = useState<"ALL" | "RED" | "YELLOW" | "BLUE">("ALL");

  // Active Selected Zone for Detailed Inspection
  const [affectedZone, setAffectedZone] = useState<string>("Zone 1");
  const [settingsZone, setSettingsZone] = useState<string>("Zone 1");

  // Full-Screen Camera Inspection Modal State
  const [expandedCameraZone, setExpandedCameraZone] = useState<string | null>(null);

  // Live IST Clock
  const [istTimeStr, setIstTimeStr] = useState<string>("");

  // Independent Per-Zone Threshold Configurations
  const [zoneThresholds, setZoneThresholds] = useState<Record<string, ZoneThreshold>>({
    "Zone 1": { tempThreshold: 75, vibThreshold: 3.0 },
    "Zone 2": { tempThreshold: 70, vibThreshold: 2.8 },
    "Zone 3": { tempThreshold: 75, vibThreshold: 3.0 },
    "Zone 4": { tempThreshold: 80, vibThreshold: 3.5 },
    "Zone 5": { tempThreshold: 72, vibThreshold: 3.2 },
    "Zone 6": { tempThreshold: 78, vibThreshold: 3.4 },
    "Zone 7": { tempThreshold: 76, vibThreshold: 3.1 },
    "Zone 8": { tempThreshold: 74, vibThreshold: 2.9 },
    "Zone 9": { tempThreshold: 82, vibThreshold: 3.6 },
    "Zone 10": { tempThreshold: 70, vibThreshold: 2.5 },
    "Zone 11": { tempThreshold: 75, vibThreshold: 3.0 },
    "Zone 12": { tempThreshold: 72, vibThreshold: 2.7 },
  });

  const initialISTTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }) + " IST";

  // Independent Real-Time Present Telemetry per Zone
  const [zoneTelemetryMap, setZoneTelemetryMap] = useState<Record<string, ZoneTelemetry>>({
    "Zone 1": { temp: 45, vib: 2.1, current: 52, status: "Green", health: 95, rulDays: 88, rulPercent: 88, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 2": { temp: 42, vib: 1.8, current: 48, status: "Green", health: 96, rulDays: 94, rulPercent: 94, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 3": { temp: 48, vib: 2.3, current: 55, status: "Green", health: 92, rulDays: 62, rulPercent: 62, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 4": { temp: 44, vib: 2.0, current: 50, status: "Green", health: 94, rulDays: 45, rulPercent: 45, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },

    "Zone 5": { temp: 46, vib: 2.2, current: 53, status: "Green", health: 93, rulDays: 82, rulPercent: 82, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 6": { temp: 43, vib: 1.9, current: 49, status: "Green", health: 95, rulDays: 90, rulPercent: 90, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 7": { temp: 47, vib: 2.4, current: 54, status: "Green", health: 91, rulDays: 71, rulPercent: 71, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 8": { temp: 41, vib: 1.7, current: 47, status: "Green", health: 97, rulDays: 95, rulPercent: 95, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },

    "Zone 9": { temp: 49, vib: 2.5, current: 56, status: "Green", health: 90, rulDays: 58, rulPercent: 58, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 10": { temp: 40, vib: 1.6, current: 46, status: "Green", health: 98, rulDays: 98, rulPercent: 98, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 11": { temp: 45, vib: 2.1, current: 51, status: "Green", health: 94, rulDays: 79, rulPercent: 79, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
    "Zone 12": { temp: 43, vib: 1.9, current: 50, status: "Green", health: 95, rulDays: 85, rulPercent: 85, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal Baseline" },
  });

  const [saveNotification, setSaveNotification] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // Track previous zone statuses to log ONLY pure color transitions
  const prevZoneStatusRef = useRef<Record<string, "Green" | "Blue" | "Yellow" | "Red">>({
    "Zone 1": "Green",
    "Zone 2": "Green",
    "Zone 3": "Green",
    "Zone 4": "Green",
    "Zone 5": "Green",
    "Zone 6": "Green",
    "Zone 7": "Green",
    "Zone 8": "Green",
    "Zone 9": "Green",
    "Zone 10": "Green",
    "Zone 11": "Green",
    "Zone 12": "Green",
  });

  // Clean Telemetry Audit Logs (Stores ONLY actual color transitions)
  const [historyLogs, setHistoryLogs] = useState<TelemetryLog[]>([
    {
      id: "ALERT-8001",
      timestamp: initialISTTime,
      zone: "Zone 1",
      status: "Red",
      vibration: "6.8 mm/s",
      temperature: "88 °C",
      healthIndex: 35,
      isPinned: true,
      attended: false,
      transitionText: "Green → RED (Limit Breach)",
    },
    {
      id: "ALERT-7002",
      timestamp: initialISTTime,
      zone: "Zone 3",
      status: "Yellow",
      vibration: "3.4 mm/s",
      temperature: "76 °C",
      healthIndex: 68,
      isPinned: true,
      attended: false,
      transitionText: "Green → YELLOW (Setpoint Breach)",
    },
  ]);

  // Real-Time IST Ticking Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setIstTimeStr(`${timeStr} IST`);
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // When Manager changes, update scoping cleanly to manager's 4 distinct non-overlapping zones
  useEffect(() => {
    if (!currentManager.assignedZones.includes(affectedZone)) {
      setAffectedZone(currentManager.assignedZones[0]);
    }
    if (!currentManager.assignedZones.includes(settingsZone)) {
      setSettingsZone(currentManager.assignedZones[0]);
    }
  }, [currentManager]);

  // Helper: Evaluate Status based on zone thresholds
  const evaluateStatus = (
    temp: number,
    vib: number,
    tLimit: number,
    vLimit: number
  ): "Green" | "Blue" | "Yellow" | "Red" => {
    if (temp >= tLimit + 15 || vib >= vLimit + 4) return "Red";
    if (temp >= tLimit || vib >= vLimit) return "Yellow";
    if (temp >= tLimit - 10 || vib >= vLimit - 1) return "Blue";
    return "Green";
  };

  // LIVE TELEMETRY STREAM: Connects to Node.js / MQTT / AI Gateway via Socket.IO
  useEffect(() => {
    const socket = io("http://localhost:3000", {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[App] Connected to KRATOS Telemetry Engine");
    });

    socket.on("telemetry", (packet: any) => {
      if (!isLiveSimulating || isEmergencyStopped) return;

      const fz = packet.digital_twin?.fault_zone;
      const zone = fz ? (typeof fz === "number" ? `Zone ${fz}` : String(fz)) : affectedZone;

      const tele = packet.telemetry || {};
      const rawVib = typeof tele.vibration_g === "number" ? tele.vibration_g : 1.5;
      const rawTemp = typeof tele.temperature_c === "number" ? tele.temperature_c : 45;
      const rawCurrent = typeof tele.current_amps === "number" ? tele.current_amps : 50;

      const limits = zoneThresholds[zone] || { tempThreshold: 75, vibThreshold: 3.0 };

      // AI Decision with Defensible Heuristic Fallback
      let calculatedStatus: "Green" | "Blue" | "Yellow" | "Red" = "Green";
      if (packet.ai && packet.ai.ai_available && packet.ai.status && packet.ai.status !== "UNKNOWN") {
        const s = String(packet.ai.status).toUpperCase();
        if (s === "RED") calculatedStatus = "Red";
        else if (s === "YELLOW") calculatedStatus = "Yellow";
        else calculatedStatus = "Green";
      } else {
        calculatedStatus = evaluateStatus(rawTemp, rawVib, limits.tempThreshold, limits.vibThreshold);
      }

      const rulDays = typeof packet.ai?.rul_days === "number"
        ? Math.round(packet.ai.rul_days)
        : (typeof packet.rul_days === "number" ? Math.round(packet.rul_days) : 42);

      const rulPercent = Math.min(99, Math.max(10, Math.round((rulDays / 60) * 100)));

      const calculatedHealth = typeof packet.ai?.confidence === "number"
        ? Math.min(99, Math.max(15, Math.round(packet.ai.confidence)))
        : Math.max(15, Math.min(99, 100 - Math.round((rawTemp / limits.tempThreshold) * 30 + (rawVib / limits.vibThreshold) * 20)));

      setZoneTelemetryMap((prev) => {
        const prevStatus = prevZoneStatusRef.current[zone];
        const colorChanged = prevStatus !== undefined && calculatedStatus !== prevStatus;

        const updatedZone: ZoneTelemetry = {
          ...(prev[zone] || {
            temp: rawTemp,
            vib: rawVib,
            current: rawCurrent,
            status: calculatedStatus,
            health: calculatedHealth,
            rulDays,
            rulPercent,
            lastTransitionTime: "",
            lastTransitionEvent: "",
          }),
          temp: rawTemp,
          vib: rawVib,
          current: rawCurrent,
          status: calculatedStatus,
          health: calculatedHealth,
          rulDays,
          rulPercent,
        };

        if (colorChanged) {
          const istTimestamp = new Date().toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }) + " IST";

          const transitionText = `${prevStatus} → ${calculatedStatus.toUpperCase()}${
            packet.ai?.confidence ? ` (${packet.ai.confidence}% conf)` : ""
          }`;
          const isPinned = calculatedStatus === "Red" || calculatedStatus === "Yellow";

          updatedZone.lastTransitionTime = istTimestamp;
          updatedZone.lastTransitionEvent = transitionText;
          prevZoneStatusRef.current[zone] = calculatedStatus;

          setHistoryLogs((prevLogs) => [
            {
              id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
              timestamp: istTimestamp,
              zone,
              status: calculatedStatus,
              vibration: `${rawVib} mm/s`,
              temperature: `${rawTemp} °C`,
              healthIndex: calculatedHealth,
              isPinned,
              attended: false,
              transitionText,
            },
            ...prevLogs.slice(0, 49),
          ]);

          if (zone === affectedZone && calculatedStatus === "Red" && !showCriticalModal) {
            setShowCriticalModal(true);
          }
        }

        return {
          ...prev,
          [zone]: updatedZone,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isLiveSimulating, isEmergencyStopped, affectedZone, zoneThresholds, showCriticalModal]);

  // Derive parameters for active affectedZone
  const activeZoneTelemetry = zoneTelemetryMap[affectedZone] || {
    temp: 45,
    vib: 2.1,
    current: 52,
    status: "Green",
    health: 94,
    rulDays: 88,
    rulPercent: 88,
    lastTransitionTime: initialISTTime,
    lastTransitionEvent: "Nominal Baseline",
  };

  const activeParameters: ParameterState[] = [
    { name: "Vibration", key: "vib", value: activeZoneTelemetry.vib, unit: "mm/s", status: activeZoneTelemetry.status, zone: affectedZone },
    { name: "Current Draw", key: "curr", value: activeZoneTelemetry.current, unit: "A", status: activeZoneTelemetry.status, zone: affectedZone },
    { name: "Conveyor Speed", key: "spd", value: 2.45, unit: "m/s", status: "Green", zone: affectedZone },
    { name: "Bearing Temp", key: "temp", value: activeZoneTelemetry.temp, unit: "°C", status: activeZoneTelemetry.status, zone: affectedZone },
    { name: "Belt Tension", key: "ten", value: 95, unit: "%", status: "Green", zone: affectedZone },
    { name: "Belt Drift", key: "drift", value: 3, unit: "mm", status: "Green", zone: affectedZone },
  ];

  // Save Threshold Settings Handler
  const handleSaveConfiguration = () => {
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 3000);
  };

  // Mark Pinned Alert as Attended / Resolved
  const handleAttendAlert = (logId: string) => {
    setHistoryLogs((prev) =>
      prev.map((log) => (log.id === logId ? { ...log, attended: true, isPinned: false } : log))
    );
  };

  // CSV Audit Report Exporter
  const handleExportCSV = () => {
    const headers = "Event ID,Timestamp (IST),Sector Zone,Temperature,Vibration,Health Score,Status,Transition\n";
    const rows = historyLogs
      .map(
        (log) =>
          `"${log.id}","${log.timestamp}","${log.zone}","${log.temperature}","${log.vibration}","${log.healthIndex}/100","${log.status}","${log.transitionText || ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NMDC_Shift_Audit_Report_${currentManager.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Badge styles
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Green":
        return "border-emerald-500 text-emerald-400 bg-emerald-950/80 font-bold shadow-sm shadow-emerald-900/50";
      case "Blue":
        return "border-blue-400 text-blue-300 bg-blue-900/90 font-bold shadow-sm shadow-blue-800/80";
      case "Yellow":
        return "border-yellow-300 text-yellow-200 bg-yellow-900/90 font-bold shadow-sm shadow-yellow-700/80";
      case "Red":
        return "border-red-500 text-red-300 bg-red-950/90 font-bold animate-pulse shadow-sm shadow-red-900/50";
      default:
        return "border-stone-600 text-stone-300 bg-stone-800";
    }
  };

  // Gauge stroke and glow dynamics
  const getGaugeRingStroke = (status: string) => {
    switch (status) {
      case "Blue":
        return "text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.8)]";
      case "Yellow":
        return "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]";
      case "Red":
        return "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]";
      case "Green":
      default:
        return "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]";
    }
  };

  const getGaugeRingGlow = (status: string) => {
    switch (status) {
      case "Blue":
        return "bg-blue-500/50";
      case "Yellow":
        return "bg-yellow-500/50";
      case "Red":
        return "bg-red-600/60";
      case "Green":
      default:
        return "bg-emerald-500/50";
    }
  };

  // Personalized SOP Procedures per Zone
  const getWorkflowSteps = (zone: string, status: string) => {
    const limits = zoneThresholds[zone] || { tempThreshold: 75, vibThreshold: 3.0 };
    const meta = ZONE_METADATA[zone] || { title: zone, component: "Sector Assembly" };

    if (status === "Red") {
      return [
        {
          id: 1,
          title: `CRITICAL INDUSTRIAL SOP: Emergency Interlock Active on ${zone} (${meta.title})`,
          desc: `Severe thermal/vibration constraint breach on ${meta.component}. Telemetry breached setpoint (${limits.tempThreshold}°C / ${limits.vibThreshold} mm/s). Auto E-STOP interlock engaged.`,
        },
        {
          id: 2,
          title: `Dispatch Field Response Crew to ${zone}`,
          desc: `Field Supervisor ${currentManager.name} dispatched to inspect ${meta.component}. Inspect bearing lube reservoirs, mechanical housing, and sensor leads.`,
        },
        {
          id: 3,
          title: `Apply LOTO & Thermal Reduction Clearance`,
          desc: `Lockout/Tagout (LOTO) active on ${zone}. Conveyor re-engagement prohibited until temperature drops safely below ${limits.tempThreshold}°C.`,
        },
      ];
    } else if (status === "Yellow") {
      return [
        {
          id: 1,
          title: `PRE-WARNING SOP: Telemetry Encroachment on ${zone} (${meta.title})`,
          desc: `Vibration/Thermal parameter encroaching constraint limits on ${meta.component} (${limits.tempThreshold}°C / ${limits.vibThreshold} mm/s).`,
        },
        {
          id: 2,
          title: `Schedule Maintenance Inspection & Lube (${zone})`,
          desc: `Flag ${zone} maintenance log for preventive shaft alignment, bearing re-greasing, and sensor calibration during next shift change.`,
        },
      ];
    } else if (status === "Blue") {
      return [
        {
          id: 1,
          title: `MINOR VARIANCE SOP: Baseline Variance Logged on ${zone} (${meta.title})`,
          desc: `Elevated telemetry variance on ${meta.component}. System operating safely within design tolerance limits.`,
        },
        {
          id: 2,
          title: `High-Frequency Telemetry Tracking (${zone})`,
          desc: `Record high-frequency sensor baseline in NMDC central historical database for predictive wear modeling.`,
        },
      ];
    }
    return [
      {
        id: 1,
        title: `NOMINAL SOP: ${zone} (${meta.title}) Performing Within Specs`,
        desc: `All mechanical & electrical metrics across ${meta.component} are operating within optimal limits (${limits.tempThreshold}°C / ${limits.vibThreshold} mm/s).`,
      },
      {
        id: 2,
        title: `Continuous Automated Plant Scanning Active`,
        desc: `Autonomous sensor telemetry logging active for ${currentManager.name}'s division sector.`,
      },
    ];
  };

  // Pinned alerts
  const pinnedAlerts = historyLogs.filter((l) => l.isPinned && !l.attended);

  // Filter audit logs for Search
  const filteredAuditLogs = historyLogs.filter((log) => {
    const matchesSearch =
      log.id.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      log.zone.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      log.status.toLowerCase().includes(historySearchQuery.toLowerCase());

    if (alertFilter === "RED") return matchesSearch && log.status === "Red";
    if (alertFilter === "YELLOW") return matchesSearch && log.status === "Yellow";
    if (alertFilter === "BLUE") return matchesSearch && log.status === "Blue";
    return matchesSearch;
  });

  return (
    <div className="flex h-screen bg-[#EBE5D8] font-sans text-stone-900 overflow-hidden relative">
      
      {/* ---------------- FULL-SCREEN CAMERA INSPECTION MODAL ---------------- */}
      {expandedCameraZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 animate-in fade-in zoom-in-95">
          <div className="bg-[#190808] border-2 border-amber-500/60 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col text-stone-100 shadow-2xl overflow-hidden relative">
            
            {/* Interlock Belt Halted Banner if Belt is Emergency Stopped */}
            {isEmergencyStopped && (
              <div className="bg-red-600 text-white font-extrabold px-4 py-2 text-xs font-mono flex items-center justify-between animate-pulse border-b border-red-400">
                <span className="flex items-center gap-2">
                  <OctagonX className="h-4 w-4" /> 🚨 EMERGENCY BELT INTERLOCK ENGAGED — CONVEYOR BELT IS HALTED (ESTOP ACTIVE)
                </span>
                <button
                  onClick={() => setIsEmergencyStopped(false)}
                  className="px-3 py-1 bg-white text-red-900 hover:bg-stone-200 rounded font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1 shadow"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-red-800" /> RESTART BELT NOW
                </button>
              </div>
            )}

            {/* Modal Header */}
            <div className="p-4 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500 text-black font-extrabold rounded-lg text-xs font-mono">
                  CAM-{expandedCameraZone.replace("Zone ", "0")}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white font-mono flex items-center gap-2">
                    {expandedCameraZone}: {ZONE_METADATA[expandedCameraZone]?.title}
                  </h3>
                  <p className="text-xs text-stone-400">
                    Component: <strong className="text-yellow-400">{ZONE_METADATA[expandedCameraZone]?.component}</strong> • Manager: {currentManager.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded text-xs font-mono font-black border ${getStatusBadge(zoneTelemetryMap[expandedCameraZone]?.status || "Green")}`}>
                  STATUS: {zoneTelemetryMap[expandedCameraZone]?.status || "Green"}
                </span>

                <button
                  onClick={() => setExpandedCameraZone(null)}
                  className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto p-5 gap-6 font-mono text-xs">
              
              {/* Left Column: Expanded HD Computer Vision Viewport (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                <div className="relative aspect-video bg-black rounded-xl border-2 border-stone-800 overflow-hidden flex flex-col justify-between p-4 shadow-inner">
                  
                  {/* Vision Overlay Controls */}
                  <div className="flex justify-between items-center z-10">
                    <span className="bg-red-950/90 text-red-300 border border-red-600 px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> LIVE 4K CV SCANNING (30 FPS)
                    </span>
                    <span className="text-[10px] text-stone-400 bg-stone-900/80 px-2 py-0.5 rounded border border-stone-800">
                      MODEL: YOLO-v8 ORE DEFECT MODEL
                    </span>
                  </div>

                  {/* Computer Vision Anomaly Highlights & Scanning Canvas */}
                  <div className="my-auto text-center z-10 py-6">
                    <Camera className="h-12 w-12 text-amber-400 mx-auto mb-2" />
                    <p className="font-bold text-sm text-stone-200 uppercase tracking-wider">
                      {expandedCameraZone} • COMPUTER VISION INGESTION
                    </p>

                    {zoneTelemetryMap[expandedCameraZone]?.status !== "Green" ? (
                      <div className="mt-3 bg-red-950/90 border-2 border-red-600 rounded-xl p-3 text-red-200 space-y-1.5 max-w-md mx-auto shadow-xl">
                        <div className="flex items-center justify-center gap-2 font-black text-red-300 text-xs">
                          <OctagonX className="h-4 w-4 text-red-400" />
                          CV DEFECT BOUNDING BOX DETECTED
                        </div>
                        <p className="text-[11px] text-red-200">
                          Surface shear & thermal anomaly detected on {ZONE_METADATA[expandedCameraZone]?.component}.
                        </p>
                        <div className="flex justify-around text-[10px] pt-1 text-yellow-300 border-t border-red-900/60 font-bold">
                          <span>Temp: {zoneTelemetryMap[expandedCameraZone]?.temp}°C</span>
                          <span>Vib: {zoneTelemetryMap[expandedCameraZone]?.vib} mm/s</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-emerald-400 text-xs mt-2 font-bold bg-emerald-950/40 p-2 rounded border border-emerald-800 max-w-xs mx-auto">
                        ✓ Surface Structural Nominal • Zero Defect Flags
                      </p>
                    )}
                  </div>

                  {/* Vision Overlay Footer */}
                  <div className="flex justify-between items-center text-[10px] text-stone-400 pt-2 border-t border-stone-800 z-10">
                    <span>Limit: {zoneThresholds[expandedCameraZone]?.tempThreshold}°C / {zoneThresholds[expandedCameraZone]?.vibThreshold}mm/s</span>
                    <span>NMDC Sector Line: {currentManager.division.split(":")[0]}</span>
                  </div>
                </div>

                {/* Real-time Sector Metrics Grid */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-black/50 border border-stone-800 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] text-stone-400 block">Bearing Temp</span>
                    <span className="text-sm font-bold text-white">{zoneTelemetryMap[expandedCameraZone]?.temp} °C</span>
                  </div>
                  <div className="bg-black/50 border border-stone-800 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] text-stone-400 block">Vibration RMS</span>
                    <span className="text-sm font-bold text-white">{zoneTelemetryMap[expandedCameraZone]?.vib} mm/s</span>
                  </div>
                  <div className="bg-black/50 border border-stone-800 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] text-stone-400 block">Current Draw</span>
                    <span className="text-sm font-bold text-white">{zoneTelemetryMap[expandedCameraZone]?.current} A</span>
                  </div>
                  <div className="bg-black/50 border border-stone-800 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] text-stone-400 block">Remaining Life</span>
                    <span className="text-sm font-bold text-yellow-400">{zoneTelemetryMap[expandedCameraZone]?.rulDays} Days</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Deep Anomaly Analysis & Generated SOP Workflow (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                
                {/* Sector Problem Breakdown Analysis */}
                <div className="bg-black/50 border border-stone-800 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-400" />
                    Sector Problem & Diagnostic Analysis
                  </h4>

                  {zoneTelemetryMap[expandedCameraZone]?.status !== "Green" ? (
                    <div className="bg-red-950/40 border border-red-800 p-3 rounded-lg text-stone-300 space-y-1.5">
                      <div className="text-red-300 font-bold text-xs">
                        ⚠️ Active Constraint Breach in {expandedCameraZone}
                      </div>
                      <p className="text-[11px] leading-relaxed text-stone-400">
                        {ZONE_METADATA[expandedCameraZone]?.component} has exceeded safe operating parameters. Temperature ({zoneTelemetryMap[expandedCameraZone]?.temp}°C vs {zoneThresholds[expandedCameraZone]?.tempThreshold}°C) or Vibration ({zoneTelemetryMap[expandedCameraZone]?.vib} mm/s vs {zoneThresholds[expandedCameraZone]?.vibThreshold} mm/s).
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/40 border border-emerald-800 p-3 rounded-lg text-emerald-300 space-y-1">
                      <div className="font-bold text-xs">✓ Sector Operating Normally</div>
                      <p className="text-[11px] text-stone-400">
                        All telemetry sensors on {ZONE_METADATA[expandedCameraZone]?.component} are operating within safe tolerance parameters.
                      </p>
                    </div>
                  )}
                </div>

                {/* Proposed Generated SOP Workflow for Manager */}
                <div className="bg-black/50 border border-stone-800 rounded-xl p-4 flex-1 space-y-3">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-400" />
                    Generated Action SOP Workflow ({expandedCameraZone})
                  </h4>

                  <div className="space-y-2.5">
                    {getWorkflowSteps(expandedCameraZone, zoneTelemetryMap[expandedCameraZone]?.status || "Green").map((step) => (
                      <div key={step.id} className="p-3 bg-stone-900/80 rounded-lg border border-stone-800 flex items-start gap-3">
                        <div className="h-6 w-6 rounded bg-amber-500 text-black font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          0{step.id}
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-stone-200">{step.title}</h5>
                          <p className="text-[10px] text-stone-400 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manager Executive Actions (Interactive Belt E-STOP Interlock / Restart) */}
                <div className="flex gap-2">
                  {isEmergencyStopped ? (
                    <button
                      onClick={() => setIsEmergencyStopped(false)}
                      className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <RotateCcw className="h-4 w-4" /> RESTART CONVEYOR BELT (CLEAR ESTOP)
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEmergencyStopped(true)}
                      className="flex-1 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded-lg uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <OctagonX className="h-4 w-4" /> EXECUTE EMERGENCY BELT E-STOP
                    </button>
                  )}

                  <button
                    onClick={() => setExpandedCameraZone(null)}
                    className="px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-lg text-xs transition-all"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ---------------- CRITICAL EMERGENCY POP-UP MODAL ---------------- */}
      {showCriticalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#1F0B0B] border-2 border-red-600 rounded-2xl max-w-lg w-full p-6 text-stone-100 shadow-2xl relative">
            <button
              onClick={() => setShowCriticalModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 text-red-200 bg-red-950/80 p-3 rounded-xl mb-4 border border-red-600">
              <OctagonX className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <h3 className="font-extrabold text-base text-red-300">CRITICAL ANOMALY AUTOMATIC INTERLOCK</h3>
                <p className="text-xs text-red-200">{affectedZone} ({ZONE_METADATA[affectedZone]?.title}) Limit Breach</p>
              </div>
            </div>

            <div className="space-y-2 my-4 text-xs font-mono text-stone-300">
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Sector Target:</span>
                <span className="font-bold text-red-400">{affectedZone} - {ZONE_METADATA[affectedZone]?.title}</span>
              </div>
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Dynamic Bearing Temp:</span>
                <span className="font-bold text-red-400">
                  {zoneTelemetryMap[affectedZone]?.temp} °C (Limit: {zoneThresholds[affectedZone]?.tempThreshold} °C)
                </span>
              </div>
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Dynamic Vibration:</span>
                <span className="font-bold text-red-400">
                  {zoneTelemetryMap[affectedZone]?.vib} mm/s (Limit: {zoneThresholds[affectedZone]?.vibThreshold} mm/s)
                </span>
              </div>
            </div>

            <p className="text-xs text-yellow-200/90 mb-6 bg-yellow-950/40 p-3 rounded border border-yellow-700/50">
              ⚠️ Acknowledging will execute an immediate <strong>Emergency Conveyor Belt Interlock (E-STOP)</strong>.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsEmergencyStopped(true);
                  setShowCriticalModal(false);
                }}
                className="flex-1 py-3 bg-red-800 hover:bg-red-700 text-stone-100 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <OctagonX className="h-4 w-4" /> Acknowledge & Execute E-STOP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- LEFT NAVIGATION SIDEBAR ---------------- */}
      <aside className="w-64 bg-[#1F0B0B] text-stone-200 flex flex-col justify-between p-4 shrink-0 border-r border-stone-800">
        <div>
          <div className="flex items-center gap-3 px-3 py-4 border-b border-stone-800 mb-6">
            <div className="bg-gradient-to-br from-yellow-400 via-amber-500 to-red-600 p-2.5 rounded-xl text-black shadow-lg shadow-amber-500/20 flex items-center justify-center font-extrabold border border-yellow-300">
              <Zap className="h-6 w-6 text-black fill-black" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-wider text-white uppercase font-mono">
                Convit
              </h1>
              <p className="text-[10px] text-yellow-400 font-mono tracking-widest uppercase font-semibold">
                NMDC Steel Engine
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("home")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "home"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <HomeIcon className="h-4 w-4" />
              Home Overview
            </button>

            <button
              onClick={() => setActiveTab("workflow_alerts")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "workflow_alerts"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <ListCheck className="h-4 w-4" />
              SOP Workflows & Alerts
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "history"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <Database className="h-4 w-4" />
              Shift Audit & Analytics
            </button>

            <button
              onClick={() => setActiveTab("live")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "live"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <Video className="h-4 w-4" />
              Live Cam Grid (4 Zones)
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              Threshold Controls
            </button>
          </nav>
        </div>

        {/* Manager Credentials Switcher */}
        <div className="pt-4 border-t border-stone-800 relative">
          <button
            onClick={() => setShowManagerMenu(!showManagerMenu)}
            className="w-full flex items-center justify-between p-2.5 bg-stone-900/90 hover:bg-stone-800 rounded-xl border border-stone-700 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs border border-yellow-300">
                {currentManager.avatar}
              </div>
              <div className="text-xs">
                <p className="font-bold text-white leading-tight">{currentManager.name}</p>
                <p className="text-[10px] text-yellow-400">{currentManager.role}</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </button>

          {/* Credentials Selector Popup */}
          {showManagerMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#190808] border border-amber-500/40 rounded-xl p-2 shadow-2xl z-50 space-y-1.5 font-mono text-xs">
              <p className="text-[10px] uppercase text-stone-400 px-2 py-1 font-bold border-b border-stone-800">
                Switch Industrial Credentials:
              </p>
              {MANAGERS.map((mgr) => (
                <button
                  key={mgr.id}
                  onClick={() => {
                    setCurrentManager(mgr);
                    setShowManagerMenu(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-all flex flex-col ${
                    currentManager.id === mgr.id
                      ? "bg-amber-500/20 text-yellow-300 border border-amber-500/50 font-bold"
                      : "text-stone-300 hover:bg-stone-900"
                  }`}
                >
                  <span className="font-semibold flex items-center justify-between">
                    {mgr.name}
                    {currentManager.id === mgr.id && <UserCheck className="h-3.5 w-3.5 text-yellow-400" />}
                  </span>
                  <span className="text-[9px] text-stone-400">{mgr.role}</span>
                  <span className="text-[9px] text-amber-400/90 mt-0.5">
                    Sectors: {mgr.assignedZones.map((z) => z.replace("Zone ", "Z")).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- MAIN VIEW AREA ---------------- */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#1F0B0B] tracking-tight uppercase font-mono">
                {activeTab === "home"
                  ? "Home Dashboard"
                  : activeTab === "workflow_alerts"
                  ? "SOP Workflows & Present Values"
                  : activeTab === "history"
                  ? "Shift Audit & Analytics Report"
                  : activeTab === "live"
                  ? "Live Camera Grid (4 Managed Zones)"
                  : "Threshold Controls"}
              </h2>
              <p className="text-xs text-stone-600 font-medium">
                {currentManager.division} • <strong className="text-[#1F0B0B]">{currentManager.name}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Simulation Stream Toggle */}
              <button
                onClick={() => setIsLiveSimulating(!isLiveSimulating)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border shadow-sm ${
                  isLiveSimulating
                    ? "bg-emerald-950 text-emerald-400 border-emerald-600"
                    : "bg-stone-800 text-stone-400 border-stone-700"
                }`}
              >
                {isLiveSimulating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isLiveSimulating ? "Streaming (5s)" : "Paused"}
              </button>

              {/* Real-time IST Clock */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-stone-200 text-stone-800 border border-stone-300 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-stone-700" />
                <span className="text-[10px] uppercase text-stone-500 font-bold">IST TIME:</span>
                <span className="text-amber-900 font-bold">{istTimeStr || "05:30:00 PM IST"}</span>
              </div>

              {/* Active Alerts Bell Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-stone-200 text-stone-800 border border-stone-300 shadow-sm relative">
                <Bell className="h-3.5 w-3.5 text-amber-700" />
                <span className="text-[10px] uppercase text-stone-500 font-bold">ALERTS:</span>
                <span className="text-amber-900 font-bold">
                  {historyLogs.filter((l) => l.status === "Red" || l.status === "Yellow").length}
                </span>
              </div>

              {/* Belt Operation Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                isEmergencyStopped 
                  ? "bg-red-200 text-red-900 border-red-400 font-bold animate-pulse"
                  : "bg-stone-200 text-stone-800 border-stone-300"
              }`}>
                <Radio className="h-3.5 w-3.5 text-red-800" />
                {isEmergencyStopped ? "BELT: STOPPED" : "BELT: RUNNING"}
              </div>
            </div>
          </div>

          {/* TAB 1: HOME DASHBOARD */}
          {activeTab === "home" && (
            <div className="space-y-6">
              
              {/* Active Constraint Summary Banner */}
              <div className="bg-[#1F0B0B] text-stone-100 p-5 rounded-2xl shadow-md border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-900 border border-stone-700 rounded-xl text-yellow-400">
                    <Zap className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono uppercase text-stone-400">
                      NMDC Telemetry Sector Constraint Status
                    </span>
                    <h3 className="text-xl font-extrabold text-white font-mono flex items-center gap-2">
                      Detected Color Zone:
                      <span className={`px-3 py-0.5 rounded text-sm uppercase font-mono font-black border ${getStatusBadge(activeZoneTelemetry.status)}`}>
                        {activeZoneTelemetry.status} ({affectedZone})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="text-left md:text-right font-mono text-xs text-stone-300 space-y-1">
                  <div>Temp Setpoint ({affectedZone}): <strong className="text-yellow-400">{zoneThresholds[affectedZone]?.tempThreshold} °C</strong></div>
                  <div>Vib Setpoint ({affectedZone}): <strong className="text-yellow-400">{zoneThresholds[affectedZone]?.vibThreshold} mm/s</strong></div>
                  <div>Sector Health Score: <strong className="text-yellow-400">{activeZoneTelemetry.health}%</strong></div>
                </div>
              </div>

              {/* Real-time Sector Digital Twin Map */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-5 text-stone-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-xs tracking-wide text-stone-200 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-amber-400" />
                      NMDC Sector Digital Twin Map ({currentManager.division})
                    </h3>
                    <p className="text-[10px] text-stone-400 mt-0.5 font-mono">
                      Click a sector zone node to inspect telemetry in right sidebar
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-stone-900 px-3 py-1 rounded border border-stone-700">
                    SCOPED: {currentManager.assignedZones.join(" • ")}
                  </span>
                </div>

                <div className="relative h-40 bg-black/60 rounded-xl border border-stone-800 p-4 flex flex-col justify-between">
                  <div className="relative w-full h-14 my-auto flex items-center justify-between px-8">
                    <div className="absolute top-1/2 left-10 right-10 h-1 bg-stone-800 -translate-y-1/2 rounded-full" />

                    {currentManager.assignedZones.map((zone) => {
                      const isTarget = zone === affectedZone;
                      const zStatus = zoneTelemetryMap[zone]?.status || "Green";

                      return (
                        <div key={zone} className="relative z-10 flex flex-col items-center">
                          <button
                            onClick={() => setAffectedZone(zone)}
                            className={`h-11 w-11 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all ${
                              getStatusBadge(zStatus) + (isTarget ? " scale-110 ring-4 ring-yellow-400 shadow-xl" : "")
                            }`}
                          >
                            Z{zone.replace("Zone ", "")}
                          </button>
                          <span className="text-[10px] font-mono text-stone-200 mt-1 font-bold">
                            {ZONE_METADATA[zone]?.title.split(" ")[0] || zone}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-2 border-t border-stone-800">
                    <span>Inspecting: <strong className="text-yellow-400">{affectedZone} ({ZONE_METADATA[affectedZone]?.title})</strong></span>
                    <span>Manager Scope: <strong className="text-stone-300">{currentManager.name}</strong></span>
                  </div>
                </div>
              </div>

              {/* PREDICTIVE REMAINING USEFUL LIFE (RUL) TRACKER */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-5 text-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div>
                    <h3 className="font-semibold text-xs tracking-wide text-stone-200 flex items-center gap-2">
                      <Hourglass className="h-4 w-4 text-amber-400" />
                      Predictive Component Remaining Useful Life (RUL) Tracker
                    </h3>
                    <p className="text-[10px] text-stone-400 mt-0.5 font-mono">
                      Estimated days remaining until required maintenance service per sector component
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800">
                    AI WEAR FORECASTING ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                  {currentManager.assignedZones.map((zone) => {
                    const zTelem = zoneTelemetryMap[zone] || { rulDays: 80, rulPercent: 80, status: "Green" };

                    return (
                      <div
                        key={zone}
                        onClick={() => setAffectedZone(zone)}
                        className={`p-3.5 bg-black/40 rounded-xl border transition-all cursor-pointer hover:border-amber-500/80 ${
                          affectedZone === zone ? "border-amber-500 ring-1 ring-amber-500/50" : "border-stone-800"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-white">{zone}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            zTelem.rulPercent > 70
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : zTelem.rulPercent > 45
                              ? "bg-yellow-950 text-yellow-300 border border-yellow-800"
                              : "bg-red-950 text-red-300 border border-red-800"
                          }`}>
                            {zTelem.rulPercent > 70 ? "Optimal" : zTelem.rulPercent > 45 ? "Service Due" : "Action Required"}
                          </span>
                        </div>

                        <div className="text-[10px] text-stone-400 truncate mb-2" title={ZONE_METADATA[zone]?.component}>
                          {ZONE_METADATA[zone]?.component}
                        </div>

                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[10px] text-stone-400">RUL Forecast:</span>
                          <span className="text-sm font-bold text-amber-400">{zTelem.rulDays} Days</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              zTelem.rulPercent > 70
                                ? "bg-emerald-500"
                                : zTelem.rulPercent > 45
                                ? "bg-yellow-400"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${zTelem.rulPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MERGED SOP WORKFLOWS & PRESENT VALUE LIVE STATUS BOARD */}
          {activeTab === "workflow_alerts" && (
            <div className="space-y-6">
              
              {/* Dynamic SOP Procedures for Selected Zone */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <ListCheck className="h-5 w-5 text-amber-400" />
                      Industrial SOP Procedures ({affectedZone}: {ZONE_METADATA[affectedZone]?.title})
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Target Component: <strong className="text-yellow-400">{ZONE_METADATA[affectedZone]?.component}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-stone-400 text-[10px] uppercase font-bold">Select Zone:</span>
                    {currentManager.assignedZones.map((z) => (
                      <button
                        key={z}
                        onClick={() => setAffectedZone(z)}
                        className={`px-2.5 py-1 rounded text-xs font-bold border transition-all ${
                          affectedZone === z
                            ? "bg-amber-500 text-black border-yellow-300 shadow"
                            : "bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-800"
                        }`}
                      >
                        {z.replace("Zone ", "Z")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {getWorkflowSteps(affectedZone, zoneTelemetryMap[affectedZone]?.status || "Green").map((step) => (
                    <div key={step.id} className="p-4 bg-black/40 rounded-xl border border-stone-800 flex items-start gap-4">
                      <div className="h-8 w-8 rounded-lg bg-amber-500 text-black font-mono text-sm font-bold flex items-center justify-center shrink-0">
                        0{step.id}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-stone-200">{step.title}</h4>
                        <p className="text-xs text-stone-400 mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PINNED HIGH-PRIORITY ALERTS SECTION */}
              <div className="bg-[#1F0B0B] border-2 border-red-900/60 rounded-2xl p-6 text-stone-100 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Pin className="h-5 w-5 text-red-400 fill-red-400" />
                    <h3 className="text-base font-bold text-white font-mono">
                      Pinned High-Priority Alerts (Critical Red & Warning Yellow)
                    </h3>
                  </div>
                  <span className="text-xs font-mono bg-red-950 text-red-300 px-2.5 py-0.5 rounded border border-red-800 font-bold">
                    {pinnedAlerts.length} UNATTENDED
                  </span>
                </div>

                {pinnedAlerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-900 rounded-xl">
                    ✓ All high-priority alerts have been attended and resolved. Zero active critical pins.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pinnedAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3.5 bg-red-950/40 border border-red-700/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={`h-5 w-5 shrink-0 ${alert.status === "Red" ? "text-red-400 animate-pulse" : "text-yellow-400"}`} />
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{alert.id}</span> • <span>{alert.zone}</span> ({ZONE_METADATA[alert.zone]?.title})
                            </div>
                            <div className="text-stone-300 text-[11px] mt-0.5">
                              {alert.transitionText || `${alert.status} breach`} • Temp: {alert.temperature} • Vib: {alert.vibration} ({alert.timestamp})
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAttendAlert(alert.id)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase font-mono rounded-lg transition-all flex items-center gap-1.5 shrink-0 shadow"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Attended / Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PRESENT VALUE LIVE SECTOR STATUS BOARD (NO REPETITIVE LONG LOG LIST!) */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="h-5 w-5 text-amber-400" />
                      Current Sector Live Status Board (Present Values Only)
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Evaluated every 5 seconds. Displays <strong>ONLY PRESENT VALUES</strong> and timestamp of last color status change.
                    </p>
                  </div>

                  <span className="text-xs font-mono bg-stone-900 border border-stone-700 px-3 py-1 rounded text-stone-300">
                    EVALUATION CADENCE: 5 SECONDS
                  </span>
                </div>

                {/* Vertical Stacked Strip Layout (Distinct from 2x2 Camera Grid) */}
                <div className="flex flex-col space-y-3 font-mono text-xs">
                  {currentManager.assignedZones.map((zone) => {
                    const zTelem = zoneTelemetryMap[zone] || { temp: 45, vib: 2.1, current: 60, status: "Green", healthIndex: 95, rulDays: 90, lastTransitionTime: initialISTTime, lastTransitionEvent: "Nominal" };
                    const isSelected = affectedZone === zone;

                    return (
                      <div
                        key={zone}
                        onClick={() => setAffectedZone(zone)}
                        className={`p-3.5 bg-black/60 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          zTelem.status === "Red"
                            ? "border-red-500 bg-red-950/20 ring-1 ring-red-500/50"
                            : zTelem.status === "Yellow"
                            ? "border-yellow-400 bg-yellow-950/20 ring-1 ring-yellow-500/50"
                            : zTelem.status === "Blue"
                            ? "border-blue-400 bg-blue-950/20 ring-1 ring-blue-500/50"
                            : isSelected
                            ? "border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/40"
                            : "border-stone-800 hover:border-amber-500/60 hover:bg-stone-900/40"
                        }`}
                      >
                        {/* Left: Zone Info & Status Badge */}
                        <div className="flex items-center gap-3 md:w-1/3 shrink-0">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-black text-xs border shrink-0 ${getStatusBadge(zTelem.status)}`}>
                            Z{zone.replace("Zone ", "")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white">{zone}</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${getStatusBadge(zTelem.status)}`}>
                                {zTelem.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400 truncate">
                              {ZONE_METADATA[zone]?.title}
                            </p>
                          </div>
                        </div>

                        {/* Center: Live Present Telemetry Metrics */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 flex-1 bg-stone-900/80 p-2 rounded-lg border border-stone-800/80 text-center">
                          <div>
                            <span className="text-[9px] text-stone-400 block uppercase font-semibold">Bearing Temp</span>
                            <span className="text-xs font-black text-white">{zTelem.temp} °C</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-stone-400 block uppercase font-semibold">Vibration RMS</span>
                            <span className="text-xs font-black text-white">{zTelem.vib} mm/s</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-stone-400 block uppercase font-semibold">Motor Current</span>
                            <span className="text-xs font-black text-white">{zTelem.current} A</span>
                          </div>
                          <div className="hidden sm:block">
                            <span className="text-[9px] text-stone-400 block uppercase font-semibold">Est. Wear RUL</span>
                            <span className="text-xs font-black text-emerald-400">{zTelem.rulDays || 88} Days</span>
                          </div>
                        </div>

                        {/* Right: Last Color Transition Timestamp & Event Tag */}
                        <div className="flex md:flex-col items-center md:items-end justify-between text-[10px] text-stone-400 md:w-1/4 shrink-0 border-t md:border-t-0 md:border-l border-stone-800/80 pt-2 md:pt-0 md:pl-4">
                          <div className="text-right">
                            <span className="text-[9px] text-stone-500 block uppercase font-bold">Last Color Transition</span>
                            <span className="text-xs font-bold text-yellow-400">{zTelem.lastTransitionTime}</span>
                          </div>
                          <span className="text-amber-400 font-bold text-[10px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 mt-1">
                            [{zTelem.lastTransitionEvent}]
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SHIFT AUDIT & HISTORICAL ANALYTICS */}
          {activeTab === "history" && (
            <div className="space-y-6">
              
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
                <div className="bg-[#1F0B0B] border border-stone-800 p-4 rounded-xl text-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Color Transitions</div>
                  <div className="text-2xl font-black text-yellow-400 mt-1">{historyLogs.length}</div>
                  <div className="text-[9px] text-stone-400 mt-1">Logged color changes</div>
                </div>

                <div className="bg-[#1F0B0B] border border-stone-800 p-4 rounded-xl text-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Critical Halts</div>
                  <div className="text-2xl font-black text-red-400 mt-1">
                    {historyLogs.filter(l => l.status === "Red").length}
                  </div>
                  <div className="text-[9px] text-red-300 mt-1">Interlock E-STOP events</div>
                </div>

                <div className="bg-[#1F0B0B] border border-stone-800 p-4 rounded-xl text-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Warning Pre-Alerts</div>
                  <div className="text-2xl font-black text-yellow-300 mt-1">
                    {historyLogs.filter(l => l.status === "Yellow").length}
                  </div>
                  <div className="text-[9px] text-yellow-200 mt-1">Setpoints encroached</div>
                </div>

                <div className="bg-[#1F0B0B] border border-stone-800 p-4 rounded-xl text-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold">Plant Uptime Index</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">98.4%</div>
                  <div className="text-[9px] text-emerald-300 mt-1">Operational reliability</div>
                </div>
              </div>

              {/* Clean Shift Audit Database Table */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-amber-400" />
                      NMDC Shift Telemetry Audit & Transition Log
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Official shift log required for Ministry of Steel audit records. Stores only actual color transition events.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 font-mono">
                    {/* Status Color Filter Pills */}
                    <div className="flex items-center bg-black/60 border border-stone-800 rounded-lg p-1 gap-1">
                      <Filter className="h-3.5 w-3.5 text-amber-400 ml-1.5 mr-0.5" />
                      {(["ALL", "RED", "YELLOW", "BLUE"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setAlertFilter(mode)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            alertFilter === mode
                              ? mode === "RED"
                                ? "bg-red-700 text-white"
                                : mode === "YELLOW"
                                ? "bg-yellow-500 text-black"
                                : mode === "BLUE"
                                ? "bg-blue-600 text-white"
                                : "bg-amber-500 text-black"
                              : "text-stone-400 hover:text-white"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Filter Zone / Status..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-black/60 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      onClick={handleExportCSV}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase rounded-lg transition-all flex items-center gap-1.5 shadow"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV Report
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs text-stone-300 border-collapse">
                    <thead>
                      <tr className="border-b border-stone-800 bg-black/50 text-stone-400 uppercase text-[10px]">
                        <th className="p-3">Event ID</th>
                        <th className="p-3">Timestamp (IST)</th>
                        <th className="p-3">Sector Zone</th>
                        <th className="p-3">Transition Event</th>
                        <th className="p-3">Vibration</th>
                        <th className="p-3">Temperature</th>
                        <th className="p-3">Health</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-900/50 transition-colors">
                          <td className="p-3 font-bold text-amber-400">{log.id}</td>
                          <td className="p-3 text-stone-300">{log.timestamp}</td>
                          <td className="p-3 font-bold text-stone-200">{log.zone}</td>
                          <td className="p-3 text-yellow-300 font-bold">{log.transitionText || log.status}</td>
                          <td className="p-3">{log.vibration}</td>
                          <td className="p-3">{log.temperature}</td>
                          <td className="p-3 font-bold">{log.healthIndex}%</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusBadge(log.status)}`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE 4-ZONE CAMERA GRID WITH FULL-SCREEN INSPECTION */}
          {activeTab === "live" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Camera className="h-5 w-5 text-amber-400" />
                    Multi-Camera Computer Vision Inspection Grid ({currentManager.name})
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Click any camera card to open <strong>Full-Screen Inspection View</strong> with sector problem analysis & SOP workflows.
                  </p>
                </div>
                <span className="text-xs font-mono bg-amber-500/20 text-yellow-300 border border-amber-500/50 px-3 py-1.5 rounded-lg font-bold">
                  SCOPED: {currentManager.assignedZones.join(" • ")}
                </span>
              </div>

              {/* 2x2 Camera Feed Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentManager.assignedZones.map((zone, idx) => {
                  const isSelected = zone === affectedZone;
                  const zTelemetry = zoneTelemetryMap[zone] || { status: "Green" };
                  const zStatus = zTelemetry.status;
                  const hasAnomaly = zStatus !== "Green";

                  return (
                    <div
                      key={zone}
                      onClick={() => setExpandedCameraZone(zone)}
                      className={`relative bg-black/80 rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between h-64 group hover:scale-[1.01] ${
                        zStatus === "Red"
                          ? "border-red-500 ring-2 ring-red-600/80 shadow-lg shadow-red-950/80 animate-pulse"
                          : zStatus === "Yellow"
                          ? "border-yellow-400 ring-2 ring-yellow-500/50 shadow-md shadow-yellow-950/50"
                          : zStatus === "Blue"
                          ? "border-blue-400 ring-2 ring-blue-500/50 shadow-md shadow-blue-950/50"
                          : isSelected
                          ? "border-amber-500 ring-2 ring-amber-500/40"
                          : "border-stone-800 hover:border-amber-500/60"
                      }`}
                    >
                      {/* Camera Viewport Header */}
                      <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400 bg-stone-900/90 px-2 py-0.5 rounded border border-stone-700">
                            CAM-0{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-white">{zone}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${getStatusBadge(zStatus)}`}>
                            {zStatus}
                          </span>
                          <Maximize2 className="h-4 w-4 text-stone-400 group-hover:text-yellow-400 transition-colors" />
                        </div>
                      </div>

                      {/* Vision Feed Canvas Overlay */}
                      <div className="my-auto text-center z-10 py-2">
                        <Video className={`h-8 w-8 mx-auto mb-1.5 ${hasAnomaly ? "text-amber-400" : "text-stone-500"}`} />
                        <p className="font-mono text-[11px] text-stone-200 font-bold">
                          {ZONE_METADATA[zone]?.title}
                        </p>
                        
                        {hasAnomaly ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-red-950/90 border border-red-600 text-red-300 rounded text-[10px] font-mono font-bold">
                            <OctagonX className="h-3.5 w-3.5 text-red-400" />
                            [ALERT] Computer vision anomaly detected on {ZONE_METADATA[zone]?.component}!
                          </div>
                        ) : (
                          <p className="font-mono text-[10px] text-emerald-400 mt-1">
                            ✓ Surface Nominal • Zero Defect Flag
                          </p>
                        )}
                      </div>

                      {/* Camera Footer */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-2 border-t border-stone-800 z-10">
                        <span>Limit: {zoneThresholds[zone]?.tempThreshold}°C / {zoneThresholds[zone]?.vibThreshold}mm/s</span>
                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" /> Click for Full-Screen SOP View
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: INDEPENDENT PER-ZONE THRESHOLD CONTROLS */}
          {activeTab === "settings" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-6">
              <div className="border-b border-stone-800 pb-4">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-amber-400" />
                  Independent Per-Zone Threshold Configurations
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Configure unique temperature and vibration limit thresholds for each of <strong className="text-yellow-400">{currentManager.name}'s 4 assigned zones</strong>. Selecting a zone tab below switches the configuration sliders directly for that specific zone.
                </p>
              </div>

              {/* Direct Zone Selection Buttons */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-stone-400 text-[10px] uppercase font-bold mr-1">Select Managed Zone to Configure:</span>
                {currentManager.assignedZones.map((z) => (
                  <button
                    key={z}
                    onClick={() => setSettingsZone(z)}
                    className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                      settingsZone === z
                        ? "bg-amber-500 text-black border-yellow-300 shadow-md scale-105"
                        : "bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-800"
                    }`}
                  >
                    {z} ({ZONE_METADATA[z]?.title.split(" ")[0]})
                  </button>
                ))}
              </div>

              {/* Threshold Controls for `settingsZone` */}
              <div className="space-y-5 max-w-lg bg-black/50 p-6 rounded-xl border border-stone-800 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div>
                    <span className="font-bold text-white text-sm">Configuring Target: </span>
                    <span className="text-yellow-400 font-bold">{settingsZone}</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-yellow-300 border border-amber-500/50 rounded text-[10px] font-bold">
                    {ZONE_METADATA[settingsZone]?.component}
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-2">
                    {settingsZone} Motor Temperature Limit Threshold: <strong className="text-yellow-400">{zoneThresholds[settingsZone]?.tempThreshold} °C</strong>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={zoneThresholds[settingsZone]?.tempThreshold || 75}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setZoneThresholds((prev) => ({
                        ...prev,
                        [settingsZone]: {
                          ...prev[settingsZone],
                          tempThreshold: val,
                        },
                      }));
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-2">
                    {settingsZone} Vibration RMS Limit Threshold: <strong className="text-yellow-400">{zoneThresholds[settingsZone]?.vibThreshold.toFixed(1)} mm/s</strong>
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="6.0"
                    step="0.1"
                    value={zoneThresholds[settingsZone]?.vibThreshold || 3.0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setZoneThresholds((prev) => ({
                        ...prev,
                        [settingsZone]: {
                          ...prev[settingsZone],
                          vibThreshold: val,
                        },
                      }));
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => handleSaveConfiguration()}
                  className="py-3 px-4 w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono uppercase rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Save className="h-4 w-4" /> Save Configuration for {settingsZone}
                </button>

                {saveNotification && (
                  <p className="text-xs text-emerald-400 font-mono text-center">
                    ✓ Threshold configuration for <strong>{settingsZone}</strong> saved successfully!
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ---------------- RIGHT SIDEBAR PANEL (System Health & Dynamic Ring Gauge) ---------------- */}
        <aside className="w-80 bg-[#1F0B0B] text-stone-200 p-5 border-l border-stone-800 flex flex-col shrink-0 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-center font-mono text-xs font-bold tracking-widest text-white mb-1 uppercase">
              Overall System Health
            </h3>
            <p className="text-center text-[10px] text-stone-400 font-mono">
              Sector: {affectedZone} ({ZONE_METADATA[affectedZone]?.title})
            </p>
          </div>

          {/* System Health Gauge with Dynamic Ring & Glow */}
          <div className="relative w-36 h-36 mx-auto flex flex-col items-center justify-center">
            <div className={`absolute inset-0 rounded-full blur-xl opacity-60 transition-all duration-500 ${getGaugeRingGlow(activeZoneTelemetry.status)}`} />

            <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 36 36">
              <path
                className="text-stone-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`transition-all duration-500 ${getGaugeRingStroke(activeZoneTelemetry.status)}`}
                strokeDasharray={`${activeZoneTelemetry.health}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute z-20 flex flex-col items-center">
              <span className="text-3xl font-extrabold font-mono text-white">
                {activeZoneTelemetry.health}
              </span>
              <span className="text-[9px] text-stone-400 font-mono">/ 100 Index</span>
            </div>
          </div>

          <div className="bg-black/50 border border-stone-800 p-3 rounded-xl text-[11px] text-stone-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-stone-200 font-bold">
              <Info className="h-3.5 w-3.5 text-amber-400" /> NMDC Sector Analysis
            </div>
            <p className="text-[10px] leading-relaxed text-stone-400">
              Continuously computing telemetry deviations on <strong className="text-yellow-400">{ZONE_METADATA[affectedZone]?.component}</strong> in active sector <strong className="text-yellow-400">{affectedZone}</strong>.
            </p>
          </div>

          {/* Dynamic Metrics Breakdown List for Active Affected Zone */}
          <div className="border-t border-stone-800 pt-4 space-y-3">
            <h4 className="text-xs font-mono text-stone-400">
              Live Sensor Telemetry ({affectedZone})
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {activeParameters.map((p) => (
                <div
                  key={p.name}
                  className="bg-black/40 border border-stone-800 p-2 rounded flex flex-col items-center text-center"
                >
                  <span className="text-[9px] font-mono text-stone-400 font-semibold">
                    {p.name}
                  </span>
                  <div className="my-0.5 font-mono text-sm font-bold text-white">
                    {p.value} <span className="text-[9px] text-stone-400 font-normal">{p.unit}</span>
                  </div>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border ${getStatusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}