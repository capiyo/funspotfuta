const std = @import("std");

const StreamConfig = struct {
    api_base_url: []const u8,
    public_origin: []const u8,
    srs_api_url: []const u8,
};

fn valid_fixture_id(value: []const u8) bool {
    if (value.len == 0 or value.len > 128) return false;
    for (value) |ch| {
        if (!((ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or
            (ch >= '0' and ch <= '9') or ch == '-' or ch == '_')) return false;
    }
    return true;
}

fn valid_http_url(value: []const u8) bool {
    return std.mem.startsWith(u8, value, "https://") or
        std.mem.startsWith(u8, value, "http://");
}

fn read_config(allocator: std.mem.Allocator) !StreamConfig {
    const api = std.process.getEnvVarOwned(allocator, "FUNSPOT_API_BASE_URL") catch
        return error.MissingFunspotApiBaseUrl;
    const origin = std.process.getEnvVarOwned(allocator, "FUNSPOT_VIDEO_PUBLIC_ORIGIN") catch
        return error.MissingPublicOrigin;
    const srs = std.process.getEnvVarOwned(allocator, "SRS_INTERNAL_API_URL") catch
        return error.MissingSrsInternalApiUrl;

    if (!valid_http_url(api) or !valid_http_url(origin) or !valid_http_url(srs)) {
        return error.InvalidServiceUrl;
    }

    return .{
        .api_base_url = api,
        .public_origin = origin,
        .srs_api_url = srs,
    };
}

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    const config = try read_config(allocator);

    // This binary currently performs strict startup/config validation.
    // Playback authorization and SRS control-plane routes are deliberately
    // not exposed until the Rust API grant contract is implemented and tested.
    std.log.info(
        "video gateway configuration valid; api={s}, public_origin={s}, srs_api={s}",
        .{ config.api_base_url, config.public_origin, config.srs_api_url },
    );
}

test "fixture ids reject path separators and whitespace" {
    try std.testing.expect(valid_fixture_id("fixture_2026-11-01"));
    try std.testing.expect(!valid_fixture_id("../admin"));
    try std.testing.expect(!valid_fixture_id("fixture id"));
    try std.testing.expect(!valid_fixture_id(""));
}

test "service urls require an http scheme" {
    try std.testing.expect(valid_http_url("https://api.example.test"));
    try std.testing.expect(!valid_http_url("file:///etc/passwd"));
    try std.testing.expect(!valid_http_url("rtmp://media.example.test/live"));
}