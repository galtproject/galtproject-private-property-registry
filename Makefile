.PHONY: test coverage

cleanup:
	rm -rf ./build

compile: cleanup
	npm run compile
	node scripts/logContractSizes.js
	-tput bel

lint:
	npm run ethlint
	npm run eslint

lint-fix:
	npm run ethlint
	npm run eslint-fix

test:
	-npm test
	-tput bel

deploy:
	-npm run deploy
	-tput bel

coverage:
	-npm run coverage
	-tput bel

ganache:
	bash ./scripts/runGanache.sh

check-size:
	node scripts/checkContractSize.js

ctest: compile test
