# Hermes Provider Integration

This directory contains Hermes-only deep integration assets.

`setup-hermes-provider.sh` is not part of the shared runtime. It exists to wire the Human-Like Memory provider into Hermes as a native `memory.provider`.

It is copied into the Hermes distribution by `scripts/build-distributions.mjs`.
