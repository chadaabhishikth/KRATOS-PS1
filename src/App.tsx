import React, { useState, useEffect } from "react";
import {
  Home as HomeIcon,
  Video,
  ListCheck,
  Bell,
  Settings as SettingsIcon,
  Clock,
  ShieldAlert,
  Sliders,
  Radio,
  Eye,
  Camera,
  X,
  OctagonX,
  Plus,
  Minus,
  Info,
  Filter,
  Zap,
  Save,
  CheckCircle2,
  Database,
  Play,
  Pause,
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
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "home" | "live" | "workflow" | "alerts" | "settings" | "history"
  >("home");

  // Simulation Control State
  const [isLiveSimulating, setIsLiveSimulating] = useState<boolean>(true);

  // Critical Pop-Up State & Emergency Stop State
  const [showCriticalModal, setShowCriticalModal] = useState<boolean>(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);
  const [alertFilter, setAlertFilter] = useState<"ALL" | "RED" | "YELLOW">("ALL");

  // Threshold States (Configurable in Settings)
  const [tempThreshold, setTempThreshold] = useState<number>(75);
  const [vibThreshold, setVibThreshold] = useState<number>(3.0);
  const [saveNotification, setSaveNotification] = useState<boolean>(false);

  // System Overall State
  const [systemHealth, setSystemHealth] = useState<number>(92);
  const [activeState, setActiveState] = useState<"Green" | "Blue" | "Yellow" | "Red">("Green");
  const [affectedZone, setAffectedZone] = useState<string>("Zone 3");

  // 7 Raw Dynamic Telemetry Parameters
  const [parameters, setParameters] = useState<ParameterState[]>([
    { name: "Vibration", key: "vib", value: 2.1, unit: "mm/s", status: "Green", zone: "Zone 3" },
    { name: "Current", key: "curr", value: 52, unit: "A", status: "Green", zone: "Zone 1" },
    { name: "Speed", key: "spd", value: 2.5, unit: "m/s", status: "Green", zone: "Zone 2" },
    { name: "Temperature", key: "temp", value: 45, unit: "°C", status: "Green", zone: "Zone 3" },
    { name: "Tension", key: "ten", value: "98.5" as any, unit: "%", status: "Green", zone: "Zone 3" },
    { name: "Drift", key: "drift", value: 2, unit: "mm", status: "Green", zone: "Zone 4" },
    { name: "Sag", key: "sag", value: 5, unit: "mm", status: "Green", zone: "Zone 5" },
  ]);

  // Continuous Telemetry History Table State
  const [historyLogs, setHistoryLogs] = useState<TelemetryLog[]>([
    {
      id: "LOG-1001",
      timestamp: "20:14:10 EST",
      zone: "Zone 3",
      status: "Green",
      vibration: "2.1 mm/s",
      temperature: "45 °C",
      healthIndex: 94,
    },
  ]);

  // Helper: Determine Status based on current limits & value inputs
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

  // Continuous Dynamic Telemetry Engine (Interval Simulation)
  useEffect(() => {
    if (!isLiveSimulating || isEmergencyStopped) return;

    const interval = setInterval(() => {
      // Small random fluctuation to parameters
      const rawTemp = Math.floor(45 + Math.random() * (activeState === "Red" ? 50 : activeState === "Yellow" ? 32 : 12));
      const rawVib = parseFloat((2.0 + Math.random() * (activeState === "Red" ? 6 : activeState === "Yellow" ? 2.5 : 0.8)).toFixed(1));

      // Automated Dynamic Evaluation based on user Constraints
      const calculatedStatus = evaluateStatus(rawTemp, rawVib, tempThreshold, vibThreshold);

      // Compute Health Index
      const calculatedHealth = Math.max(
        15,
        Math.min(99, 100 - Math.round((rawTemp / tempThreshold) * 30 + (rawVib / vibThreshold) * 20))
      );

      setSystemHealth(calculatedHealth);
      setActiveState(calculatedStatus);

      // Auto Trigger Pop-Up on Critical Red Detection
      if (calculatedStatus === "Red" && !showCriticalModal) {
        setShowCriticalModal(true);
      }

      // Update Parameters
      setParameters([
        { name: "Vibration", key: "vib", value: rawVib, unit: "mm/s", status: calculatedStatus, zone: affectedZone },
        { name: "Current", key: "curr", value: Math.floor(50 + Math.random() * 25), unit: "A", status: calculatedStatus, zone: "Zone 1" },
        { name: "Speed", key: "spd", value: 2.45, unit: "m/s", status: "Green", zone: "Zone 2" },
        { name: "Temperature", key: "temp", value: rawTemp, unit: "°C", status: calculatedStatus, zone: affectedZone },
        { name: "Tension", key: "ten", value: 95, unit: "%", status: "Green", zone: "Zone 3" },
        { name: "Drift", key: "drift", value: Math.floor(2 + Math.random() * 15), unit: "mm", status: "Green", zone: "Zone 4" },
        { name: "Sag", key: "sag", value: 6, unit: "mm", status: "Green", zone: "Zone 5" },
      ]);

      // Automatically Save Data into History Table
      const newLog: TelemetryLog = {
        id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleTimeString() + " EST",
        zone: affectedZone,
        status: calculatedStatus,
        vibration: `${rawVib} mm/s`,
        temperature: `${rawTemp} °C`,
        healthIndex: calculatedHealth,
      };

      setHistoryLogs((prev) => [newLog, ...prev.slice(0, 24)]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveSimulating, activeState, affectedZone, tempThreshold, vibThreshold, showCriticalModal, isEmergencyStopped]);

  // Save Threshold Settings Function
  const handleSaveConfiguration = () => {
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 3000);
  };

  // 1. DISTINCT, TRUE COLOR BADGE STYLES (Blue = Vivid Blue, Yellow = Vivid Yellow)
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

  // Dynamic Workflows Step Generator
  const getWorkflowSteps = () => {
    if (activeState === "Red") {
      return [
        { id: 1, title: `Automatic Critical Halt (${affectedZone})`, desc: `Motor temperature / vibration parameter breach detected. Automatic pop-up engaged.` },
        { id: 2, title: `Dispatch Maintenance Unit to ${affectedZone}`, desc: `Inspect mechanical bearing assembly and verify sensor calibration.` },
        { id: 3, title: `Apply Thermal Reduction Clearance`, desc: `System locks conveyor operation until temperature clears below constraint setpoint.` },
      ];
    } else if (activeState === "Yellow") {
      return [
        { id: 1, title: `Pre-Warning Active on ${affectedZone}`, desc: `Telemetry encroaching limit parameters (${tempThreshold}°C / ${vibThreshold} mm/s).` },
        { id: 2, title: "Schedule Next-Shift Bearing Lube", desc: "Flag maintenance log entry for preventive service." },
      ];
    } else if (activeState === "Blue") {
      return [
        { id: 1, title: `Minor Telemetry Variance (${affectedZone})`, desc: "Elevated telemetry detected, system operating within tolerance range." },
        { id: 2, title: "Monitor Sector Analytics", desc: "Keep telemetry baseline recorded in live historical database." },
      ];
    }
    return [
      { id: 1, title: "System Nominal", desc: "All parameters across sectors are performing within optimal constraint limits." },
      { id: 2, title: "Automated Logging Active", desc: "Continuous sensor scanning and dataset logging enabled." },
    ];
  };

  return (
    <div className="flex h-screen bg-[#EBE5D8] font-sans text-stone-900 overflow-hidden relative">
      
      {/* ---------------- CRITICAL EMERGENCY POP-UP MODAL ---------------- */}
      {showCriticalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#1F0B0B] border-2 border-red-600 rounded-2xl max-w-lg w-full p-6 text-stone-100 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowCriticalModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 text-red-200 bg-red-950/80 p-3 rounded-xl mb-4 border border-red-600">
              <OctagonX className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <h3 className="font-extrabold text-base text-red-300">CRITICAL ANOMALY AUTOMATIC DETECTION</h3>
                <p className="text-xs text-red-200">{affectedZone} Constraint Limit Exceeded</p>
              </div>
            </div>

            <div className="space-y-2 my-4 text-xs font-mono text-stone-300">
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Sector Target:</span>
                <span className="font-bold text-red-400">{affectedZone}</span>
              </div>
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Dynamic Temperature:</span>
                <span className="font-bold text-red-400">
                  {parameters.find((p) => p.key === "temp")?.value} °C (Limit: {tempThreshold} °C)
                </span>
              </div>
              <div className="flex justify-between bg-black/40 p-2.5 rounded border border-red-900/60">
                <span>Dynamic Vibration:</span>
                <span className="font-bold text-red-400">
                  {parameters.find((p) => p.key === "vib")?.value} mm/s (Limit: {vibThreshold} mm/s)
                </span>
              </div>
            </div>

            <p className="text-xs text-yellow-200/90 mb-6 bg-yellow-950/40 p-3 rounded border border-yellow-700/50">
              ⚠️ Confirming will execute an immediate **Emergency Conveyor Belt Stop (E-STOP)**.
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
                Intelligence Engine
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
              Home
            </button>

            <button
              onClick={() => setActiveTab("workflow")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "workflow"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <ListCheck className="h-4 w-4" />
              Dynamic Workflows
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
              Saved History Logs
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
              Live Cam Feed
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "alerts"
                  ? "bg-stone-800 text-yellow-400 border border-amber-500/50 font-bold shadow-md"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>Alert Log</span>
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

        <div className="pt-4 border-t border-stone-800 flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs border border-yellow-300">
            MT
          </div>
          <div className="text-xs">
            <p className="font-medium text-stone-200">Opr. M. Thorne</p>
            <p className="text-[10px] text-stone-400">Shift Supervisor</p>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN VIEW AREA ---------------- */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#1F0B0B] tracking-tight uppercase font-mono">
                {activeTab === "home" ? "Home Dashboard" : activeTab.toUpperCase()}
              </h2>
              <p className="text-xs text-stone-600 font-medium">
                Convit Dynamic Parameter & Constraint Telemetry System
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* 2. MATCHED STD TIME BAR & BELT STATUS COLOR STYLING */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-stone-200 text-stone-800 border border-stone-300 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-stone-700" />
                <span className="text-[10px] uppercase text-stone-500 font-bold">STD TIME:</span>
                <span>08:14:49 PM EST</span>
              </div>

              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                isEmergencyStopped 
                  ? "bg-red-200 text-red-900 border-red-400"
                  : "bg-stone-200 text-stone-800 border-stone-300"
              }`}>
                <Radio className="h-3.5 w-3.5 text-red-800" />
                {isEmergencyStopped ? "BELT: STOPPED" : "BELT: RUNNING"}
              </div>
            </div>
          </div>

          {/* SIMULATION & SECTOR CONTROLLER */}
          <div className="p-3.5 bg-[#1F0B0B] rounded-xl border border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLiveSimulating(!isLiveSimulating)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border ${
                  isLiveSimulating
                    ? "bg-emerald-950 text-emerald-400 border-emerald-600"
                    : "bg-stone-800 text-stone-400 border-stone-700"
                }`}
              >
                {isLiveSimulating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isLiveSimulating ? "Live Streaming" : "Paused"}
              </button>
              <span className="text-xs font-mono text-stone-300">
                Target Sector: <strong className="text-yellow-400">{affectedZone}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-stone-400 text-[10px] uppercase mr-1">Switch Zone:</span>
              {["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6"].map((z) => (
                <button
                  key={z}
                  onClick={() => setAffectedZone(z)}
                  className={`px-2 py-0.5 rounded text-[11px] border font-bold ${
                    affectedZone === z
                      ? "bg-amber-500 text-black border-yellow-300"
                      : "bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-800"
                  }`}
                >
                  {z.replace("Zone ", "Z")}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: HOME DASHBOARD */}
          {activeTab === "home" && (
            <div className="space-y-6">
              
              {/* Dynamic Status Summary Banner */}
              <div className="bg-[#1F0B0B] text-stone-100 p-5 rounded-2xl shadow-md border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-900 border border-stone-700 rounded-xl text-yellow-400">
                    <Zap className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono uppercase text-stone-400">
                      3. Dynamic Constraint Analysis
                    </span>
                    <h3 className="text-xl font-extrabold text-white font-mono flex items-center gap-2">
                      Detected Color Zone:
                      {/* 1. DISTINCT TRUE VIVID COLOR BADGE */}
                      <span className={`px-3 py-0.5 rounded text-sm uppercase font-mono font-black border ${getStatusBadge(activeState)}`}>
                        {activeState} ({affectedZone})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="text-left md:text-right font-mono text-xs text-stone-300 space-y-1">
                  <div>Active Temp Limit: <strong className="text-yellow-400">{tempThreshold} °C</strong></div>
                  <div>Active Vib Limit: <strong className="text-yellow-400">{vibThreshold} mm/s</strong></div>
                </div>
              </div>

              {/* Digital Twin Schematic View */}
              <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-5 text-stone-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-xs tracking-wide text-stone-200 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-400" />
                    Real-time Sector Digital Twin Map
                  </h3>
                  <span className="text-[10px] font-mono text-stone-400">
                    CONTINUOUS MONITORING
                  </span>
                </div>

                <div className="relative h-36 bg-black/60 rounded-xl border border-stone-800 p-4 flex flex-col justify-between">
                  <div className="relative w-full h-12 my-auto flex items-center justify-between px-8">
                    <div className="absolute top-1/2 left-10 right-10 h-1 bg-stone-800 -translate-y-1/2 rounded-full" />

                    {["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6"].map((zone) => {
                      const isTarget = zone === affectedZone;
                      const zoneStatus = isTarget ? activeState : "Green";

                      return (
                        <div key={zone} className="relative z-10 flex flex-col items-center">
                          <button
                            onClick={() => setAffectedZone(zone)}
                            className={`h-9 w-9 rounded-full border flex items-center justify-center font-mono text-[10px] font-bold transition-all ${
                              getStatusBadge(zoneStatus) + (isTarget ? " scale-110 ring-2 ring-yellow-400" : "")
                            }`}
                          >
                            Z{zone.replace("Zone ", "")}
                          </button>
                          <span className="text-[9px] font-mono text-stone-400 mt-1">{zone}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-2 border-t border-stone-800">
                    <span>Live Sector: <strong className="text-yellow-400">{affectedZone}</strong></span>
                    <span>Status automatically computed based on telemetry limits</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: HISTORY TABLE LOGS */}
          {activeTab === "history" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-amber-400" />
                    Continuous Historical Data Logs
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Live dynamic telemetry records continuously saved into database history.
                  </p>
                </div>
                <span className="text-xs font-mono bg-stone-900 border border-stone-700 px-3 py-1 rounded text-stone-300">
                  Total Entries: {historyLogs.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs text-stone-300 border-collapse">
                  <thead>
                    <tr className="border-b border-stone-800 bg-black/50 text-stone-400 uppercase text-[10px]">
                      <th className="p-3">Log ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Sector</th>
                      <th className="p-3">Vibration</th>
                      <th className="p-3">Temperature</th>
                      <th className="p-3">Health Score</th>
                      <th className="p-3">Detected Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {historyLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-900/50 transition-colors">
                        <td className="p-3 font-bold text-amber-400">{log.id}</td>
                        <td className="p-3 text-stone-400">{log.timestamp}</td>
                        <td className="p-3 font-bold text-stone-200">{log.zone}</td>
                        <td className="p-3">{log.vibration}</td>
                        <td className="p-3">{log.temperature}</td>
                        <td className="p-3 font-bold">{log.healthIndex} / 100</td>
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
          )}

          {/* TAB 3: WORKFLOW */}
          {activeTab === "workflow" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ListCheck className="h-5 w-5 text-amber-400" />
                    Dynamic Action SOP Procedures
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Workflows automatically dynamically update based on current constraint color.
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded font-mono font-bold border ${getStatusBadge(activeState)}`}>
                  {affectedZone}: {activeState}
                </span>
              </div>

              <div className="space-y-4">
                {getWorkflowSteps().map((step) => (
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
          )}

          {/* TAB 4: LIVE CAM */}
          {activeTab === "live" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Camera className="h-5 w-5 text-amber-400" />
                  Live Computer Vision Feed
                </h3>

                {activeState === "Yellow" || activeState === "Red" ? (
                  <span className="bg-red-950 text-red-400 border border-red-600 text-xs px-3 py-1 rounded font-mono font-bold flex items-center gap-1.5 animate-pulse shadow-md shadow-red-900/50">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> ANOMALY DETECTED ({affectedZone})
                  </span>
                ) : (
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-600 text-xs px-3 py-1 rounded font-mono font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> CAM-01 NOMINAL
                  </span>
                )}
              </div>

              <div className="relative aspect-video bg-black/80 rounded-xl border border-stone-800 overflow-hidden flex items-center justify-center">
                <div className="text-center z-10 p-6">
                  <Video className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                  <p className="font-mono text-xs text-stone-200">SURFACE INSPECTION MODEL: RUNNING</p>
                  <p className="font-mono text-[11px] text-stone-400 mt-1">
                    {activeState === "Yellow" || activeState === "Red"
                      ? `[ALERT] Computer vision detected surface shear / offset variance in ${affectedZone}`
                      : "No structural anomalies detected on belt surface."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ALERTS LOG */}
          {activeTab === "alerts" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  System Alert Events Log
                </h3>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <Filter className="h-3.5 w-3.5 text-stone-400" />
                  <button
                    onClick={() => setAlertFilter("ALL")}
                    className={`px-2.5 py-1 rounded border ${
                      alertFilter === "ALL" ? "bg-stone-800 border-amber-500 text-yellow-400" : "border-stone-800 text-stone-500"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAlertFilter("RED")}
                    className={`px-2.5 py-1 rounded border ${
                      alertFilter === "RED" ? "bg-red-950 border-red-600 text-red-300" : "border-stone-800 text-stone-500"
                    }`}
                  >
                    Critical
                  </button>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {(alertFilter === "ALL" || alertFilter === "RED") && (
                  <div className="p-3.5 bg-red-950/40 border border-red-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-red-400 font-bold block">CRITICAL ALERT - {affectedZone}</span>
                      <span className="text-stone-300 text-[11px]">Dynamic value exceeded constraint limit setpoint</span>
                    </div>
                    <span className="text-[10px] text-stone-500">Live</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: THRESHOLD CONTROLS */}
          {activeTab === "settings" && (
            <div className="bg-[#1F0B0B] border border-stone-800 rounded-2xl p-6 text-stone-100 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-amber-400" />
                    Constraint Threshold Configurations
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Adjust parameter constraints to update detection sensitivity dynamically.
                  </p>
                </div>

                {saveNotification && (
                  <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-500 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-mono font-bold animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Configuration Saved & Applied!
                  </div>
                )}
              </div>

              <div className="space-y-6 max-w-xl font-mono text-xs">
                {/* Temperature Threshold Slider */}
                <div className="p-4 bg-black/50 rounded-xl border border-stone-800 space-y-3">
                  <div className="flex justify-between items-center text-stone-200">
                    <span>Motor Temperature Threshold (°C)</span>
                    <span className="text-sm font-bold text-yellow-400">{tempThreshold} °C</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTempThreshold((prev) => Math.max(40, prev - 5))}
                      className="h-8 w-8 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center font-bold text-stone-200 border border-stone-700"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min={50}
                      max={110}
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(Number(e.target.value))}
                      className="flex-1 accent-amber-500 h-2 bg-stone-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => setTempThreshold((prev) => Math.min(110, prev + 5))}
                      className="h-8 w-8 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center font-bold text-stone-200 border border-stone-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Vibration Threshold Slider */}
                <div className="p-4 bg-black/50 rounded-xl border border-stone-800 space-y-3">
                  <div className="flex justify-between items-center text-stone-200">
                    <span>Vibration RMS Limit (mm/s)</span>
                    <span className="text-sm font-bold text-yellow-400">{vibThreshold.toFixed(1)} mm/s</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setVibThreshold((prev) => Math.max(1.0, prev - 0.5))}
                      className="h-8 w-8 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center font-bold text-stone-200 border border-stone-700"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min={1.0}
                      max={10.0}
                      step={0.5}
                      value={vibThreshold}
                      onChange={(e) => setVibThreshold(Number(e.target.value))}
                      className="flex-1 accent-amber-500 h-2 bg-stone-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => setVibThreshold((prev) => Math.min(10.0, prev + 0.5))}
                      className="h-8 w-8 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center font-bold text-stone-200 border border-stone-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSaveConfiguration}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all border border-yellow-300"
                >
                  <Save className="h-4 w-4 text-black" /> Save Configuration & Apply Constraints
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ---------------- RIGHT SIDEBAR PANEL ---------------- */}
        <aside className="w-80 bg-[#1F0B0B] text-stone-200 p-5 border-l border-stone-800 flex flex-col shrink-0 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-center font-mono text-xs font-bold tracking-widest text-white mb-1 uppercase">
              Overall System Health
            </h3>
            <p className="text-center text-[10px] text-stone-400 font-mono">
              Dynamically derived telemetry index
            </p>
          </div>

          {/* System Health Gauge with Glow */}
          <div className="relative w-36 h-36 mx-auto flex flex-col items-center justify-center">
            <div className={`absolute inset-0 rounded-full blur-xl opacity-60 transition-all ${
              systemHealth < 50 ? "bg-red-600" : "bg-emerald-500"
            }`} />

            <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 36 36">
              <path
                className="text-stone-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`transition-all duration-500 ${
                  systemHealth < 50 ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                }`}
                strokeDasharray={`${systemHealth}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute z-20 flex flex-col items-center">
              <span className="text-3xl font-extrabold font-mono text-white">
                {systemHealth}
              </span>
              <span className="text-[9px] text-stone-400 font-mono">/ 100 Index</span>
            </div>
          </div>

          <div className="bg-black/50 border border-stone-800 p-3 rounded-xl text-[11px] text-stone-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-stone-200 font-bold">
              <Info className="h-3.5 w-3.5 text-amber-400" /> Real-time System Analysis
            </div>
            <p className="text-[10px] leading-relaxed text-stone-400">
              Continuously computing parameter deviations against constraints in active sector: <strong className="text-yellow-400">{affectedZone}</strong>.
            </p>
          </div>

          {/* Dynamic Metrics Breakdown List */}
          <div className="border-t border-stone-800 pt-4 space-y-3">
            <h4 className="text-xs font-mono text-stone-400">
              Live Sensor Telemetry
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {parameters.map((p) => (
                <div
                  key={p.key}
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