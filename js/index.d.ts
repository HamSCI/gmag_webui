interface Global {
    Plotly: typeof import("@types/plotly.js");
    mqtt: typeof import("mqtt");
}

interface Window extends Global {}