using SmartBuildingAPI.Endpoints;
using SmartBuildingAPI.Hubs;
using SmartBuildingAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on specific port
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenLocalhost(5135);
});

// Also force specific URL - this is critical for it to work
builder.WebHost.UseUrls("http://localhost:5135");

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register sensor services
builder.Services.AddSingleton<ISensorDataStore, SensorDataStore>();
builder.Services.AddSingleton<IPerformanceMonitor, PerformanceMonitor>();
builder.Services.AddHostedService<SensorGenerator>();

// Add SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Always enable Swagger (not just in development)
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");

// Map SignalR hub
app.MapHub<SensorHub>("/sensorHub");

// Map API endpoints
app.MapSensorEndpoints();

// Root endpoint
app.MapGet("/", () => Results.Ok(new
{
    message = "Smart Building Sensor API",
    status = "Running",
    time = DateTime.UtcNow,
    endpoints = new[]
    {
        "/swagger - API Documentation",
        "/sensorHub - SignalR Hub",
        "/api/sensors/stats - Get all sensor statistics",
        "/api/sensors/recent?count=100 - Get recent readings",
        "/api/sensors/{id}/current - Get current sensor value",
        "/api/sensors/performance - Real-time performance metrics",
        "/api/sensors/health - System health check"
    }
}))
.WithName("Root");

Console.WriteLine("=================================================");
Console.WriteLine("🚀 SmartBuildingAPI Starting...");
Console.WriteLine("📍 URL: http://localhost:5135");
Console.WriteLine("📖 Swagger: http://localhost:5135/swagger");
Console.WriteLine("🔌 SignalR: ws://localhost:5135/sensorHub");
Console.WriteLine("=================================================");

app.Run();

public partial class Program { }