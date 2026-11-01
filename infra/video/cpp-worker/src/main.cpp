#include <algorithm>
#include <cerrno>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <string_view>
#include <vector>

#include <unistd.h>

namespace {

bool has_prefix(std::string_view value, std::string_view prefix) {
    return value.size() >= prefix.size() &&
           value.substr(0, prefix.size()) == prefix;
}

bool valid_stream_key(std::string_view value) {
    if (value.empty() || value.size() > 96) return false;
    for (const unsigned char ch : value) {
        if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
              (ch >= '0' && ch <= '9') || ch == '-' || ch == '_')) {
            return false;
        }
    }
    return true;
}

bool allowed_input(std::string_view value) {
    if (!(has_prefix(value, "https://") || has_prefix(value, "rtmps://") ||
          has_prefix(value, "rtmp://") || has_prefix(value, "srt://"))) {
        return false;
    }
    for (const unsigned char ch : value) {
        if (ch <= 0x20 || ch == 0x7f) return false;
    }
    return true;
}

std::string normalized_host(std::string_view host) {
    std::string result(host);
    std::transform(result.begin(), result.end(), result.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (!result.empty() && result.back() == '.') result.pop_back();
    return result;
}

bool source_host_allowed(std::string_view url, std::string_view allowed_hosts) {
    const auto scheme_end = url.find("://");
    if (scheme_end == std::string_view::npos) return false;
    const auto authority_start = scheme_end + 3;
    const auto authority_end = url.find_first_of("/?#", authority_start);
    auto authority = url.substr(authority_start,
        authority_end == std::string_view::npos ? url.size() - authority_start
                                                : authority_end - authority_start);
    const auto at = authority.rfind('@');
    if (at != std::string_view::npos) authority.remove_prefix(at + 1);
    if (authority.empty()) return false;

    std::string_view host = authority;
    if (authority.front() == '[') {
        const auto close = authority.find(']');
        if (close == std::string_view::npos) return false;
        host = authority.substr(1, close - 1);
        if (close + 1 < authority.size() && authority[close + 1] != ':') return false;
    } else {
        const auto colon = authority.rfind(':');
        if (colon != std::string_view::npos) {
            if (authority.find(':') != colon) return false;
            host = authority.substr(0, colon);
        }
    }
    if (host.empty()) return false;
    for (const unsigned char ch : host) {
        const bool valid = (ch >= 'a' && ch <= 'z') ||
            (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') ||
            ch == '.' || ch == '-' || ch == ':';
        if (!valid) return false;
    }
    const auto candidate = normalized_host(host);

    std::size_t start = 0;
    while (start <= allowed_hosts.size()) {
        const auto comma = allowed_hosts.find(',', start);
        auto entry = allowed_hosts.substr(start,
            comma == std::string_view::npos ? allowed_hosts.size() - start
                                            : comma - start);
        while (!entry.empty() && std::isspace(static_cast<unsigned char>(entry.front()))) {
            entry.remove_prefix(1);
        }
        while (!entry.empty() && std::isspace(static_cast<unsigned char>(entry.back()))) {
            entry.remove_suffix(1);
        }
        if (!entry.empty() && entry.find('*') == std::string_view::npos &&
            normalized_host(entry) == candidate) return true;
        if (comma == std::string_view::npos) break;
        start = comma + 1;
    }
    return false;
}

bool run_self_tests() {
    const bool cases[] = {
        source_host_allowed("https://provider.example/live", "provider.example"),
        source_host_allowed("https://USER:PASS@PROVIDER.EXAMPLE:443/live", "provider.example"),
        source_host_allowed("rtmps://[2001:db8::1]:443/live", "2001:db8::1"),
        !source_host_allowed("https://cdn.provider.example/live", "provider.example"),
        !source_host_allowed("https://provider.example.evil/live", "provider.example"),
        !source_host_allowed("https://provider.example/live", "*.provider.example"),
        !source_host_allowed("https://provider.example:443/live", "other.example"),
        !source_host_allowed("https://[broken/live", "provider.example"),
    };
    for (const bool passed : cases) {
        if (!passed) return false;
    }
    return true;
}

void usage(const char* program) {
    std::cerr << "Usage: " << program
              << " --input-file /run/secrets/ingest_source --stream <fixture-stream-key>\n";
}

}  // namespace

int main(int argc, char** argv) {
    if (argc == 2 && std::string_view(argv[1]) == "--self-test") {
        if (!run_self_tests()) {
            std::cerr << "Source host allowlist self-test failed.\\n";
            return 1;
        }
        std::cout << "Source host allowlist self-test passed.\\n";
        return 0;
    }

    std::string input_file_path;
    std::string stream_key;

    for (int i = 1; i < argc; ++i) {
        const std::string_view arg(argv[i]);
        if ((arg == "--input-file" || arg == "--stream") && i + 1 < argc) {
            const std::string value(argv[++i]);
            if (arg == "--input-file") input_file_path = value;
            else stream_key = value;
        } else {
            usage(argv[0]);
            return 2;
        }
    }

    if (input_file_path.empty() || !valid_stream_key(stream_key)) {
        usage(argv[0]);
        return 2;
    }

    // The source URL can contain provider credentials. Read it from a mounted
    // secret file instead of exposing it in process arguments or logs.
    std::ifstream source_file(input_file_path);
    if (!source_file) {
        std::cerr << "Unable to read configured ingest secret file.\n";
        return 2;
    }
    std::string input((std::istreambuf_iterator<char>(source_file)),
                      std::istreambuf_iterator<char>());
    while (!input.empty() && (input.back() == '\n' || input.back() == '\r')) {
        input.pop_back();
    }

    if (!allowed_input(input)) {
        std::cerr << "Invalid source protocol or URL.\\n";
        return 2;
    }

    const char* allowed_hosts = std::getenv("VIDEO_ALLOWED_SOURCE_HOSTS");
    if (allowed_hosts == nullptr || !source_host_allowed(input, allowed_hosts)) {
        std::cerr << "Source host is not present in VIDEO_ALLOWED_SOURCE_HOSTS.\\n";
        return 2;
    }

    const std::string output = "rtmp://srs:1935/live/" + stream_key;
    std::vector<char*> command{
        const_cast<char*>("ffmpeg"),
        const_cast<char*>("-nostdin"),
        const_cast<char*>("-hide_banner"),
        const_cast<char*>("-loglevel"),
        const_cast<char*>("warning"),
        const_cast<char*>("-i"),
        input.data(),
        const_cast<char*>("-map"),
        const_cast<char*>("0:v:0"),
        const_cast<char*>("-map"),
        const_cast<char*>("0:a:0?"),
        const_cast<char*>("-vf"),
        const_cast<char*>("scale=w='min(1280,iw)':h=-2"),
        const_cast<char*>("-c:v"),
        const_cast<char*>("libx264"),
        const_cast<char*>("-preset"),
        const_cast<char*>("veryfast"),
        const_cast<char*>("-tune"),
        const_cast<char*>("zerolatency"),
        const_cast<char*>("-profile:v"),
        const_cast<char*>("baseline"),
        const_cast<char*>("-pix_fmt"),
        const_cast<char*>("yuv420p"),
        const_cast<char*>("-b:v"),
        const_cast<char*>("2500k"),
        const_cast<char*>("-maxrate"),
        const_cast<char*>("2500k"),
        const_cast<char*>("-bufsize"),
        const_cast<char*>("5000k"),
        const_cast<char*>("-g"),
        const_cast<char*>("50"),
        const_cast<char*>("-keyint_min"),
        const_cast<char*>("50"),
        const_cast<char*>("-sc_threshold"),
        const_cast<char*>("0"),
        const_cast<char*>("-c:a"),
        const_cast<char*>("aac"),
        const_cast<char*>("-b:a"),
        const_cast<char*>("128k"),
        const_cast<char*>("-ar"),
        const_cast<char*>("48000"),
        const_cast<char*>("-ac"),
        const_cast<char*>("2"),
        const_cast<char*>("-f"),
        const_cast<char*>("flv"),
        const_cast<char*>(output.c_str()),
        nullptr
    };

    // Direct exec: no shell interpolation. Input credentials are not logged.
    execvp(command.front(), command.data());
    std::cerr << "Unable to start FFmpeg: " << std::strerror(errno) << '\n';
    return 127;
}