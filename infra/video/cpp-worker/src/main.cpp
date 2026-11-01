#include <cerrno>
#include <cstring>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

#include <sys/types.h>
#include <sys/wait.h>
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
    return has_prefix(value, "https://") || has_prefix(value, "rtmps://") ||
           has_prefix(value, "rtmp://") || has_prefix(value, "srt://");
}

void usage(const char* program) {
    std::cerr << "Usage: " << program
              << " --input <authorized-source-url> --stream <fixture-stream-key>\n";
}

}  // namespace

int main(int argc, char** argv) {
    std::string input;
    std::string stream_key;

    for (int i = 1; i < argc; ++i) {
        const std::string_view arg(argv[i]);
        if ((arg == "--input" || arg == "--stream") && i + 1 < argc) {
            const std::string value(argv[++i]);
            if (arg == "--input") input = value;
            else stream_key = value;
        } else {
            usage(argv[0]);
            return 2;
        }
    }

    if (!allowed_input(input) || !valid_stream_key(stream_key)) {
        usage(argv[0]);
        std::cerr << "Invalid source protocol or stream key. Only authorized "
                     "sources may be supplied.\n";
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
        const_cast<char*>("0:v?"),
        const_cast<char*>("-map"),
        const_cast<char*>("0:a?"),
        const_cast<char*>("-c"),
        const_cast<char*>("copy"),
        const_cast<char*>("-f"),
        const_cast<char*>("flv"),
        const_cast<char*>(output.c_str()),
        nullptr
    };

    // execvp passes arguments directly: no shell interpolation or command injection.
    // Source URLs and credentials are intentionally never printed to logs.
    execvp(command.front(), command.data());
    std::cerr << "Unable to start FFmpeg: " << std::strerror(errno) << '\n';
    return 127;
}