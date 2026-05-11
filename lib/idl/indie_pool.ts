/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/indie_pool.json`.
 */
export type IndiePool = {
  "address": "EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn",
  "metadata": {
    "name": "indiePool",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Indie Pool: decentralized contribution & reputation infrastructure for indie game ecosystems."
  },
  "instructions": [
    {
      "name": "initializeOracle",
      "docs": [
        "One-shot init by the deployer. Stores the oracle pubkey and the REP",
        "mint, and creates the mint as a Token-2022 NonTransferable mint with a",
        "PDA mint authority. Idempotent guard: PDA seed `[b\"oracle\"]` so a",
        "second call fails with `account already in use`."
      ],
      "discriminator": [
        144,
        223,
        131,
        120,
        196,
        253,
        181,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "repMint",
          "docs": [
            "Token-2022 mint with the NonTransferable extension and decimals = 0",
            "(whole-number reputation points). Anchor's declarative `init` can't",
            "express NonTransferable in 0.32 (parser limitation), so we create",
            "the account + init extension + init mint manually. Other instructions",
            "re-bind this PDA as `InterfaceAccount<'info, Mint>` for type safety."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "oraclePubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "mintReputation",
      "docs": [
        "Anyone can settle the mint after verification (callable by contributor",
        "or by the oracle service). Mints `score` REP into the contributor's",
        "associated token account on the NonTransferable mint."
      ],
      "discriminator": [
        33,
        107,
        136,
        167,
        51,
        254,
        107,
        84
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "contribution.contributor",
                "account": "contribution"
              },
              {
                "kind": "account",
                "path": "contribution.nonce",
                "account": "contribution"
              }
            ]
          }
        },
        {
          "name": "contributor",
          "docs": [
            "Validated indirectly via `contribution.contributor`."
          ]
        },
        {
          "name": "repMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "contributorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "contributor"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "repMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "submitContribution",
      "docs": [
        "Contributor opens a new contribution PDA. `nonce` lets the same",
        "contributor submit multiple times (the frontend uses `Date.now()`)."
      ],
      "discriminator": [
        123,
        132,
        230,
        253,
        141,
        22,
        214,
        91
      ],
      "accounts": [
        {
          "name": "contributor",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "contributor"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "projectId",
          "type": "string"
        },
        {
          "name": "contributionType",
          "type": "string"
        },
        {
          "name": "ipfsHash",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        }
      ]
    },
    {
      "name": "verifyContribution",
      "docs": [
        "Oracle-only: writes the AI score and flips status. The signer-equality",
        "check is enforced by `has_one = oracle` on `OracleState`."
      ],
      "discriminator": [
        112,
        203,
        206,
        180,
        120,
        64,
        14,
        221
      ],
      "accounts": [
        {
          "name": "oracleSigner",
          "docs": [
            "Must equal `oracle_state.oracle`. Enforced by `has_one`."
          ],
          "signer": true
        },
        {
          "name": "oracleState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "oracle",
          "relations": [
            "oracleState"
          ]
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "contribution.contributor",
                "account": "contribution"
              },
              {
                "kind": "account",
                "path": "contribution.nonce",
                "account": "contribution"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "score",
          "type": "u8"
        },
        {
          "name": "reasoningHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "contribution",
      "discriminator": [
        182,
        187,
        14,
        111,
        72,
        167,
        242,
        212
      ]
    },
    {
      "name": "oracleState",
      "discriminator": [
        97,
        156,
        157,
        189,
        194,
        73,
        8,
        15
      ]
    }
  ],
  "events": [
    {
      "name": "contributionSubmitted",
      "discriminator": [
        233,
        209,
        91,
        212,
        239,
        41,
        224,
        118
      ]
    },
    {
      "name": "contributionVerified",
      "discriminator": [
        3,
        140,
        106,
        6,
        191,
        49,
        251,
        222
      ]
    },
    {
      "name": "reputationMinted",
      "discriminator": [
        107,
        232,
        0,
        184,
        52,
        232,
        109,
        169
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "fieldTooLong",
      "msg": "Submitted field exceeds maximum length"
    },
    {
      "code": 6001,
      "name": "invalidScore",
      "msg": "Score must be between 0 and 100"
    },
    {
      "code": 6002,
      "name": "alreadyVerified",
      "msg": "Contribution already verified"
    },
    {
      "code": 6003,
      "name": "notVerified",
      "msg": "Contribution must be verified before minting"
    },
    {
      "code": 6004,
      "name": "alreadyMinted",
      "msg": "Reputation already minted for this contribution"
    },
    {
      "code": 6005,
      "name": "unauthorizedOracle",
      "msg": "Signer is not the registered oracle"
    }
  ],
  "types": [
    {
      "name": "contribution",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "projectId",
            "type": "string"
          },
          {
            "name": "contributionType",
            "type": "string"
          },
          {
            "name": "ipfsHash",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "contributionStatus"
              }
            }
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "reasoningHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "verifiedAt",
            "type": "i64"
          },
          {
            "name": "minted",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "contributionStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "verified"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "contributionSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contribution",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "contributionVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contribution",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "approved",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "oracleState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "repMint",
            "type": "pubkey"
          },
          {
            "name": "totalContributions",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "mintAuthorityBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reputationMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contribution",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
