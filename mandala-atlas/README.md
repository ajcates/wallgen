# Mandala Atlas

A single-page, mobile-first animated mandala experience. Swipe left to step
forward through its living symmetric evolutions; swipe right to revisit one.

Serve this folder with any static server, for example:

```sh
cd mandala-atlas
python -m http.server 8080
```

Every evolution uses an ordered DNA chain of shape, distortion, and surface
effects. Its order matters: each gene transforms the output of the gene before it.
