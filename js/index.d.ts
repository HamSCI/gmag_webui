import Measurement from "./Measurement.js";

interface Global {
    mqtt: typeof import("mqtt");
    MagConnection: {
        create: (config: ConnectionConfig, handlers: {
            onReading?: Function;
            onStatus?: (code: number, retry: number) => void;
        }) => {
            connect: () => void;
            disconnect: () => void;
        };
    };
    Plotly: typeof import("@types/plotly.js");
}

interface Window extends Global {}

interface MagUsbJson {
    ts: string;
    rt: number;
    x: number;
    y: number;
    z: number;
}

type ConnectionType = "websocket" | "mqtt";
type SourceType = ConnectionType | "file";

interface MQTTSettings {
    broker: string;
    topic: string;
    username?: string;
    password?: string;
}

interface ConnectionConfig {
    type: ConnectionType;
    websocket: {
        url: string;
    };
    mqtt: MQTTSettings;
}

interface Source {
    id: string;
    name: string;
    type: SourceType;
    websocket: {
        url: string;
    };
    mqtt: MQTTSettings;
    transform: {
        x: number;
        y: number;
        z: number;
    };
    dB: {
        moving: boolean;
        h: number;
        e: number;
        z: number;
    };
}

interface DashSettings {
    displayWindow: string;
    filter: {
        enabled: boolean;
        windowSec: number;
    };
    sources: Source[];
    activeSourceId: string;
}

interface Session {
    id: string;
    measurements: Measurement[];
    sparklines: Measurement[];
    sBucket: Measurement[];
}