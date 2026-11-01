#include <cerrno>
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

void usage(const char* program) {
    std::cerr << "Usage: " << program
              << " --input-file /run/secrets/ingest_source --stream <fixture-stream-key>\n";
}

}  // namespace

int main(int argc, char** argv) {
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
        std::cerr << "Invalid source protocol or URL. Only authorized sources "
                     "may be supplied.\n";
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