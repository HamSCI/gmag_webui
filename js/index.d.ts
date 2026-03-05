interface Global {
    Plotly: typeof import("@types/plotly.js");
}

interface Window extends Global {}