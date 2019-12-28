# Galt Project Private Propety Registry

<a href="https://github.com/galtproject/galtproject-private-property-registry/actions" targe="_blank"><img alt="pipeline status" src="https://github.com/galtproject/galtproject-private-property-registry/workflows/CI/badge.svg" /></a>

## Usage

* `make cleanup` - remove solidity build artifacts
* `make compile` - compile solidity files, executes `make cleanup` before compilation
* `make test` - run tests
* `make coverage` - run solidity coverage
* `make lint` - run solidity and javascript linters
* `make ganache` - run local pre-configured ganache

For more information check out `Makefile`
