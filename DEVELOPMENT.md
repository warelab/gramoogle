# Dev procedures

## Proceed with caution
Since anything that is merged into warelab/master is deployed to production by travis-ci, we need to be relatively cautious and conservative about what makes it to warelab repo. The warelab/dev branch is where we put new, finished, production-ready features. Think of it as prerelease. Merging from warelab/dev to warelab/master should be simple and not stressful.

*Think of the warelab/dev branch as the gatekeeper to the production site.*

The dev branch is automatically deployed to http://brie.cshl.edu/gramene-search-dev

## Adding new features
For a new feature, make a *feature branch* from dev on warelab. I recommend making more granular subbranches from the feature branch for larger features. When done, rebase to the latest version of dev and issue a pull request from the feature branch. 

Here’s an example pull request from a feature branch: https://github.com/warelab/gramoogle/pull/35

## Merging pull requests
*Another dev should merge the pull request to warelab/dev*. I think this is a simple way to ensure that we take at least a little time to decide if we wish to release this feature quite soon; we should reach a consensus before a pull request is merged. It should not be surprising if a pull request is left open for a long time or even closed. 

*Comment on a pull request when taking action on it*. Pull requests are useful as high-level descriptions of complete units of functionality. Document them!

