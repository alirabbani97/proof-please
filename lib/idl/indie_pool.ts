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
      "name": "createProjectEscrow",
      "docs": [
        "Anyone can create an escrow for any `project_id`; first caller wins",
        "(PDA seed = [b\"escrow\", project_id]). The creator can optionally seed",
        "the escrow with `initial_deposit` lamports in the same tx.",
        "",
        "`lamports_per_score` is the per-score-point payout rate stored on",
        "the escrow. Subsequent `release_milestone` calls multiply this by",
        "the contribution's score to determine the payout amount."
      ],
      "discriminator": [
        123,
        82,
        214,
        21,
        239,
        169,
        52,
        224
      ],
      "accounts": [
        {
          "name": "creator",
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
          "name": "project",
          "docs": [
            "Required: the project must already be registered. If you typo the",
            "slug or it hasn't been registered yet, this fails with",
            "`AccountNotInitialized` — pointing the user at /projects/register",
            "before they can fund the escrow."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "projectId"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "projectId"
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
          "name": "projectId",
          "type": "string"
        },
        {
          "name": "initialDeposit",
          "type": "u64"
        },
        {
          "name": "lamportsPerScore",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundProjectEscrow",
      "docs": [
        "Add more lamports to an existing escrow. Anyone can fund any escrow."
      ],
      "discriminator": [
        113,
        20,
        180,
        77,
        102,
        139,
        151,
        247
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.project_id",
                "account": "projectEscrow"
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
          "name": "amount",
          "type": "u64"
        }
      ]
    },
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
      "name": "registerProject",
      "discriminator": [
        130,
        150,
        121,
        216,
        183,
        225,
        243,
        192
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "projectId"
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
          "name": "projectId",
          "type": "string"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "blurb",
          "type": "string"
        },
        {
          "name": "art",
          "type": "string"
        },
        {
          "name": "primaryType",
          "type": "string"
        }
      ]
    },
    {
      "name": "releaseMilestone",
      "docs": [
        "Oracle-signed: releases `contribution.score * escrow.lamports_per_score`",
        "from the escrow PDA to the contributor wallet. Idempotency is enforced",
        "by setting `contribution.released = true` (a separate flag from",
        "`minted` so REP and SOL payouts are independently trackable)."
      ],
      "discriminator": [
        56,
        2,
        199,
        164,
        184,
        108,
        167,
        222
      ],
      "accounts": [
        {
          "name": "oracleSigner",
          "docs": [
            "Must equal `oracle_state.oracle`. Enforced by `has_one`. Also pays",
            "rent for the release_receipt PDA below."
          ],
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
          "name": "oracle",
          "relations": [
            "oracleState"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.project_id",
                "account": "projectEscrow"
              }
            ]
          }
        },
        {
          "name": "contribution",
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
          "name": "releaseReceipt",
          "docs": [
            "`init` on the receipt PDA enforces single-release-per-contribution.",
            "Second call → \"account already in use\" → instruction aborts."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "contribution"
              }
            ]
          }
        },
        {
          "name": "contributor",
          "docs": [
            "deserialized as it's a regular wallet."
          ],
          "writable": true
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
    },
    {
      "name": "project",
      "discriminator": [
        205,
        168,
        189,
        202,
        181,
        247,
        142,
        19
      ]
    },
    {
      "name": "projectEscrow",
      "discriminator": [
        128,
        160,
        162,
        217,
        44,
        90,
        240,
        133
      ]
    },
    {
      "name": "releaseReceipt",
      "discriminator": [
        76,
        104,
        183,
        121,
        145,
        97,
        118,
        212
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
      "name": "escrowCreated",
      "discriminator": [
        70,
        127,
        105,
        102,
        92,
        97,
        7,
        173
      ]
    },
    {
      "name": "escrowFunded",
      "discriminator": [
        228,
        243,
        166,
        74,
        22,
        167,
        157,
        244
      ]
    },
    {
      "name": "milestoneReleased",
      "discriminator": [
        49,
        225,
        91,
        223,
        34,
        165,
        109,
        181
      ]
    },
    {
      "name": "projectRegistered",
      "discriminator": [
        163,
        167,
        240,
        137,
        218,
        249,
        173,
        160
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
    },
    {
      "code": 6006,
      "name": "invalidPayoutRate",
      "msg": "Payout rate must be > 0 and <= 100_000_000 lamports per score point"
    },
    {
      "code": 6007,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6008,
      "name": "escrowInsufficientFunds",
      "msg": "Escrow has insufficient SOL above rent-exempt minimum for this milestone"
    },
    {
      "code": 6009,
      "name": "escrowProjectMismatch",
      "msg": "Contribution project_id does not match escrow project_id"
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
      "name": "escrowCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "string"
          },
          {
            "name": "initialDeposit",
            "type": "u64"
          },
          {
            "name": "lamportsPerScore",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalFunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "milestoneReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrow",
            "type": "pubkey"
          },
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
          },
          {
            "name": "totalReleased",
            "type": "u64"
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
      "name": "project",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "docs": [
              "Whoever first registered this slug. Informational at MVP; could",
              "gate `close_project` or `update_project` in a future iteration."
            ],
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "string"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "blurb",
            "docs": [
              "Short pitch / blurb shown on /projects cards."
            ],
            "type": "string"
          },
          {
            "name": "art",
            "docs": [
              "Visual art ref — usually an emoji or single-char (Brutalist UI uses",
              "a procedural fallback if empty). Could also hold an IPFS hash for",
              "a real image once pinning is wired."
            ],
            "type": "string"
          },
          {
            "name": "primaryType",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "projectEscrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "docs": [
              "Whoever called `create_project_escrow`. Currently informational —",
              "no instruction is gated on this. Could become the authority for",
              "\"close_escrow\" in a future iteration."
            ],
            "type": "pubkey"
          },
          {
            "name": "oracle",
            "docs": [
              "Snapshot of `oracle_state.oracle` at creation time. Used to gate",
              "`release_milestone` even if the oracle is rotated later."
            ],
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "string"
          },
          {
            "name": "lamportsPerScore",
            "docs": [
              "Payout rate: SOL released per score point on `release_milestone`."
            ],
            "type": "u64"
          },
          {
            "name": "totalFunded",
            "type": "u64"
          },
          {
            "name": "totalReleased",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "projectRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "string"
          },
          {
            "name": "name",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "releaseReceipt",
      "docs": [
        "Idempotency marker for `release_milestone`. The PDA's existence proves",
        "the contribution's milestone has already been paid out — a second",
        "`release_milestone` call hits `init` on this account and fails with",
        "\"account already in use\". Cleaner than adding a `released` flag to",
        "the existing `Contribution` struct (which would break deserialization",
        "of contributions submitted before this upgrade)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contribution",
            "type": "pubkey"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "releasedAt",
            "type": "i64"
          },
          {
            "name": "bump",
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
