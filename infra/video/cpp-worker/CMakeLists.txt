cmake_minimum_required(VERSION 3.20)
project(funspot_video_worker LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(funspot-video-worker src/main.cpp)
enable_testing()
add_test(NAME source-host-allowlist COMMAND funspot-video-worker --self-test)
target_compile_options(funspot-video-worker PRIVATE -Wall -Wextra -Wpedantic -Werror)
install(TARGETS funspot-video-worker RUNTIME DESTINATION bin)