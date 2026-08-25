# Fonts

All three families are licensed under the **SIL Open Font License, Version 1.1**,
which permits embedding in a document — including a PDF this app generates —
without the document inheriting the licence.

| Files                  | Family                                                        | Copyright                                            | Licence                                 |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `SourceSerif4-*.woff2` | [Source Serif 4](https://github.com/adobe-fonts/source-serif) | © 2014–2023 Adobe (`http://www.adobe.com/`)          | [OFL 1.1](https://openfontlicense.org/) |
| `Manrope-*.woff2`      | [Manrope](https://github.com/sharanda/manrope)                | © 2018–2024 Mikhail Sharanda                         | [OFL 1.1](https://openfontlicense.org/) |
| `Geist-*.woff2`        | [Geist](https://vercel.com/font)                              | © 2023 Vercel, in collaboration with basement.studio | [OFL 1.1](https://openfontlicense.org/) |

The Geist files are copied verbatim from the `geist` npm package, which remains
a dependency — but the faces are declared here rather than imported from it,
because that package's export evaluates to `undefined` inside the PDF route's
server bundle.

The `.woff2` files are the Latin and Latin Extended subsets published by Google
Fonts. They are the variable builds, so one file per style covers every weight
the token set asks for.
